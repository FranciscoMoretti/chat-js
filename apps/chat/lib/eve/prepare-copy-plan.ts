import { parseSessionTranscriptSeed } from "eve/transcript";
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Read and hash one source Blob at a time, retaining only its digest and size in the plan; parallel reads would retain all attachment byte buffers.
    const source = await readPublicFile(key);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Read and hash one source Blob at a time, retaining only its digest and size in the plan; parallel reads would retain all attachment byte buffers.
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
    // oxlint-disable-next-line typescript/promise-function-async -- Metadata lookup throws synchronously for missing allocations and otherwise resolves an in-memory value; no asynchronous work exists to await.
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
