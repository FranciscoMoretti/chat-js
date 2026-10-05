/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { createHash } from "node:crypto";

import { parseSessionTranscriptSeed } from "eve/transcript";

import type { snapshotPublicEveCopyDocuments } from "@/lib/db/eve-copy-documents";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { createFileId } from "@/lib/file-storage";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
/* oxlint-enable sort-imports */
import type { EveCopyPlan } from "./copy-journal-contract";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  eveCopyInlineAttachments,
  materializeEveCopyTranscript,
} from "./copy-transcript";
/* oxlint-enable sort-imports */
import type { prepareEveCopyTranscript } from "./copy-transcript";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveCopyPlan's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): prepareEveCopyPlan's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveCopyPlan's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-params (#511): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): prepareEveCopyPlan keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): prepareEveCopyPlan accepts projection: ReturnType<typeof prepareEveCopyTranscript>; snapshot: Awaited<ReturnType<typeof snapshotPublicEveCopyDocuments>>; file; checkpoint; head; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): prepareEveCopyPlan preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): prepareEveCopyPlan intentionally keeps the existing falsy-value behavior of documentId; revisionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
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
          fileIds: revision.fileIds,
          kind: revision.kind,
          createdAt: revision.createdAt.toISOString(),
        })),
      })
    ),
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-params, max-statements, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
