/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import { parseSessionTranscriptSeed } from "eve/transcript";

import type { snapshotPublicEveCopyDocuments } from "../db/eve-copy-documents";
import { createFileStorageKey } from "../file-storage";
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
import type { EveCopyPlan } from "./copy-journal-contract";
import {
  eveCopyInlineAttachments,
  materializeEveCopyTranscript,
} from "./copy-transcript";
import type { prepareEveCopyTranscript } from "./copy-transcript";
/** Input is an authorized public projection and ancestry, never browser-supplied content. */
export const prepareEveCopyPlan = async (
  projection: ReturnType<typeof prepareEveCopyTranscript>,
  snapshot: Awaited<ReturnType<typeof snapshotPublicEveCopyDocuments>>,
  readPublicFile: (key: string) => Promise<Blob>,
  origin: string
): Promise<EveCopyPlan> => {
  const { documents, checkpoints } = snapshot;
  const resources = eveCopyDocumentResources(documents);
  const allocations = {
    files: new Map<string, string>(),
    inlineFiles: new Map<string, string>(),
    documents: new Map(
      resources.documentIds.map((id) => [id, crypto.randomUUID()])
    ),
    revisions: new Map(
      resources.revisionIds.map((id) => [id, crypto.randomUUID()])
    ),
  };
  const files: EveCopyPlan["files"] = [];
  for (const key of new Set([
    ...projection.resources.fileKeys,
    ...resources.fileKeys,
  ])) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
    const source = await readPublicFile(key);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
    const bytes = Buffer.from(await source.arrayBuffer());
    const destination = createFileStorageKey(key);
    allocations.files.set(key, destination);
    files.push({
      key: destination,
      source: { kind: "stored", key },
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      mediaType: source.type,
    });
  }
  for (const inline of eveCopyInlineAttachments(projection.seed)) {
    const destination = createFileStorageKey("attachment");
    allocations.inlineFiles.set(inline.id, destination);
    files.push({
      key: destination,
      source: { kind: "inline", base64: inline.bytes.toString("base64") },
      sha256: createHash("sha256").update(inline.bytes).digest("hex"),
      size: inline.bytes.length,
      mediaType: inline.mediaType,
    });
  }
  const metadata = new Map(
    files.map((file) => [file.key, { type: file.mediaType, size: file.size }])
  );
  const seed = await materializeEveCopyTranscript(
    projection.seed,
    allocations,
    (key) => {
      const file = metadata.get(key);
      if (!file) {
        throw new Error("Missing copied file metadata.");
      }
      return Promise.resolve(file);
    },
    origin
  );
  return {
    seed: parseSessionTranscriptSeed(seed),
    files,
    documentCheckpoints: checkpoints.map((checkpoint) => ({
      messageIndex: checkpoint.messageIndex,
      heads: checkpoint.heads.map((head) => {
        const documentId = allocations.documents.get(head.documentId);
        const revisionId = allocations.revisions.get(head.revisionId);
        if (!(documentId && revisionId)) {
          throw new Error("Missing copied document boundary allocation.");
        }
        return { documentId, revisionId };
      }),
    })),
    sourceHeads: documents.map((document) => ({
      documentId: document.documentId,
      revisionId: document.headRevisionId,
    })),
    documents: prepareEveCopyDocuments(documents, allocations).map(
      (document) => ({
        documentId: document.documentId,
        headRevisionId: document.headRevisionId,
        revisions: document.revisions.map((revision) => ({
          id: revision.id,
          parentRevisionId: revision.parentRevisionId,
          title: revision.title,
          content: revision.content,
          kind: revision.kind,
          createdAt: revision.createdAt.toISOString(),
        })),
      })
    ),
  };
};
