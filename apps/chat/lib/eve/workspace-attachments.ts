import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { lockEveFamilies } from "@/lib/db/eve-family-lock";
import { eveStoredFile, eveWorkspaceAttachment } from "@/lib/db/schema";
import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import {
  assertActiveWorkspaceMembership,
  readPersistentIdentity,
} from "./persistent-sandbox-store";
import type { EveCopySeed } from "./copy-seed";

const digest = (content: Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

/** Register an authorized immutable original before eve stages it. */
export const retainWorkspaceAttachment = async (input: {
  ownerId: string;
  sessionId: string;
  fileKey: string;
  content: Uint8Array;
}): Promise<void> => {
  const identity = await readPersistentIdentity(input.sessionId);
  if (!identity || identity.ownerId !== input.ownerId) {
    throw new Error("Attachment workspace is unavailable.");
  }
  const sha256 = digest(input.content);
  await db.transaction(async (tx) => {
    await lockEveFamilies(tx, [input.ownerId]);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`chatjs-workspace:${identity.workspaceId}`}, 0))`
    );
    await assertActiveWorkspaceMembership(tx, identity);
    const storedRows = await tx
      .select()
      .from(eveStoredFile)
      .where(
        and(
          eq(eveStoredFile.key, input.fileKey),
          eq(eveStoredFile.ownerId, input.ownerId),
          eq(eveStoredFile.state, "active")
        )
      );
    if (storedRows.length !== 1) {
      throw new Error("Original attachment is unavailable.");
    }
    await tx
      .insert(eveWorkspaceAttachment)
      .values({
        workspaceId: identity.workspaceId,
        ownerId: input.ownerId,
        fileKey: input.fileKey,
        sha256,
      })
      .onConflictDoNothing();
    const savedRows = await tx
      .select()
      .from(eveWorkspaceAttachment)
      .where(
        and(
          eq(eveWorkspaceAttachment.workspaceId, identity.workspaceId),
          eq(eveWorkspaceAttachment.fileKey, input.fileKey),
          eq(eveWorkspaceAttachment.ownerId, input.ownerId)
        )
      );
    const saved = savedRows.at(0);
    if (saved === undefined || saved.sha256 !== sha256) {
      throw new Error("Original attachment bytes changed.");
    }
  });
};

/** Called inside the provider workspace fence; paths are observed, never reconstructed. */
export const recordWorkspaceAttachment = async (input: {
  identity: { workspaceId: string; ownerId: string };
  path: string;
  content: Uint8Array;
}): Promise<void> => {
  const sha256 = digest(input.content);
  const identity = and(
    eq(eveWorkspaceAttachment.workspaceId, input.identity.workspaceId),
    eq(eveWorkspaceAttachment.ownerId, input.identity.ownerId)
  );
  const existing = await db
    .select()
    .from(eveWorkspaceAttachment)
    .where(
      and(identity, sql`${input.path} = any(${eveWorkspaceAttachment.paths})`)
    );
  if (existing.some((file) => file.sha256 !== sha256)) {
    throw new Error("Original attachment paths cannot be overwritten.");
  }
  // Inline tool results need not correspond to an uploaded original; those remain native files.
  await db
    .update(eveWorkspaceAttachment)
    .set({
      paths: sql`array(select distinct unnest(array_append(${eveWorkspaceAttachment.paths}, ${input.path})))`,
    })
    .where(and(identity, eq(eveWorkspaceAttachment.sha256, sha256)));
};

/** Undefined delegates non-uploaded files to the workspace; original corruption always throws. */
export const readWorkspaceAttachment = async (input: {
  identity: { workspaceId: string; ownerId: string };
  path: string;
}): Promise<Uint8Array | undefined> => {
  const fileRows = await db
    .select({
      fileKey: eveWorkspaceAttachment.fileKey,
      sha256: eveWorkspaceAttachment.sha256,
      state: eveStoredFile.state,
    })
    .from(eveWorkspaceAttachment)
    .innerJoin(
      eveStoredFile,
      eq(eveStoredFile.key, eveWorkspaceAttachment.fileKey)
    )
    .where(
      and(
        eq(eveWorkspaceAttachment.workspaceId, input.identity.workspaceId),
        eq(eveWorkspaceAttachment.ownerId, input.identity.ownerId),
        sql`${input.path} = any(${eveWorkspaceAttachment.paths})`
      )
    )
    .limit(1);
  const file = fileRows.at(0);
  if (file === undefined) {
    return undefined;
  }
  if (file.state !== "active") {
    throw new Error("Original attachment is unavailable.");
  }
  const blob = await downloadFile(file.fileKey);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (digest(bytes) !== file.sha256) {
    throw new Error("Original attachment bytes changed.");
  }
  return bytes;
};

/** Enrich only attachments already present in the selected trusted transcript. */
export const resolveWorkspaceSeedAttachments = async (input: {
  workspaceId: string;
  ownerId: string;
  seed: EveCopySeed;
}): Promise<EveCopySeed> => {
  const seed = structuredClone(input.seed);
  const files = await db
    .select()
    .from(eveWorkspaceAttachment)
    .where(
      and(
        eq(eveWorkspaceAttachment.workspaceId, input.workspaceId),
        eq(eveWorkspaceAttachment.ownerId, input.ownerId)
      )
    );
  for (const message of seed.messages) {
    for (const part of message.parts) {
      if (part.type !== "file") {
        continue;
      }
      const key = keyFromFileUrl(part.url);
      const file = files.find((entry) => entry.fileKey === key);
      const path = file?.paths.at(0);
      if (path === undefined || path === "") {
        throw new Error("Attachment has no observed shared workspace path.");
      }
      part.existingPath = path;
    }
  }
  return seed;
};
