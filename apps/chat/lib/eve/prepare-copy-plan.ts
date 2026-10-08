/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { parseSessionTranscriptSeed } from "eve/transcript";
/* oxlint-disable sort-imports -- eve/transcript installs the global Zod postprocessor; copy-documents constructs document schemas. Keep EVE initialization before those app schemas. */
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
/* oxlint-enable sort-imports */
import {
  eveCopyInlineAttachments,
  materializeEveCopyTranscript,
} from "./copy-transcript";
import type { EveCopyPlan } from "./copy-journal-contract";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createFileId } from "@/lib/file-storage";
import { createHash } from "node:crypto";
import type { prepareEveCopyTranscript } from "./copy-transcript";
import type { snapshotPublicEveCopyDocuments } from "@/lib/db/eve-copy-documents";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (prepareEveCopyPlan); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveCopyPlan's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable max-lines-per-function, max-params, max-statements -- * max-lines-per-function (#510): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
/**
 * Allocate destination identities and rewrite an authorized public projection and ancestry.
 * Inputs must come from server authorization, never browser-supplied content.
 * @param {ReturnType<typeof prepareEveCopyTranscript>} projection - Public transcript seed and referenced file keys to copy.
 * @param {Awaited<ReturnType<typeof snapshotPublicEveCopyDocuments>>} snapshot - Authorized document revisions and transcript checkpoints.
 * @param {(key: string) => Promise<Blob>} readPublicFile - Read an authorized source attachment to compute its digest and metadata.
 * @param {string} origin - Origin used when materializing destination attachment URLs.
 * @returns {Promise<EveCopyPlan>} Copy plan with allocated identities, source descriptors, and remapped document boundaries; no destination files are written here.
 */
export const prepareEveCopyPlan = async (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- EveChannelInput.resolveSeed returns SessionTranscriptSeed with mutable messages and parts arrays (eve execution/session-transcript-seed.d.ts). materializeEveCopyTranscript accepts and returns that Seed; deep readonly arrays are not assignable at this boundary.
  projection: Readonly<
    Pick<ReturnType<typeof prepareEveCopyTranscript>, "resources" | "seed">
  >,
  snapshot: ReadonlyNativeSurface<
    Awaited<ReturnType<typeof snapshotPublicEveCopyDocuments>>
  >,
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
  const files: EveCopyPlan["files"][number][] = [];
  for (const key of new Set([
    ...projection.resources.fileKeys,
    ...resources.fileKeys,
  ])) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
    const source = await readPublicFile(key);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
    const bytes = Buffer.from(await source.arrayBuffer());
    const destination = createFileId();
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
    const destination = createFileId();
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
    files.map(
      (file: {
        readonly key: string;
        readonly mediaType: string;
        readonly size: number;
      }) => [file.key, { type: file.mediaType, size: file.size }]
    )
  );
  const seed = await materializeEveCopyTranscript(
    projection.seed,
    allocations,
    // oxlint-disable-next-line typescript/promise-function-async -- The metadata resolver throws synchronously for a missing allocation and otherwise returns the resolved file promise unchanged.
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
      heads: checkpoint.heads.map(
        (head: Readonly<{ documentId: string; revisionId: string }>) => {
          const documentId = allocations.documents.get(head.documentId);
          const revisionId = allocations.revisions.get(head.revisionId);
          if (
            typeof documentId !== "string" ||
            documentId === "" ||
            typeof revisionId !== "string" ||
            revisionId === ""
          ) {
            throw new Error("Missing copied document boundary allocation.");
          }
          return { documentId, revisionId };
        }
      ),
    })),
    sourceHeads: documents.map(
      (document: {
        readonly documentId: string;
        readonly headRevisionId: string;
      }) => ({
        documentId: document.documentId,
        revisionId: document.headRevisionId,
      })
    ),
    documents: prepareEveCopyDocuments(documents, allocations).map(
      (document) => ({
        documentId: document.documentId,
        headRevisionId: document.headRevisionId,
        revisions: document.revisions.map((revision) => ({
          id: revision.id,
          parentRevisionId: revision.parentRevisionId,
          title: revision.title,
          content: revision.content,
          fileIds: revision.fileIds,
          kind: revision.kind,
          createdAt: revision.createdAt.toISOString(),
        })),
      })
    ),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-params, max-statements */
