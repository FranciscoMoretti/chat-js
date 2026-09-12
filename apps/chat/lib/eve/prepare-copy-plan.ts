import { createHash } from "node:crypto";
import { parseSessionTranscriptSeed } from "eve/channels/eve";
import { createFileStorageKey } from "../file-storage";
import {
  eveCopyDocumentResources,
  prepareEveCopyDocuments,
} from "./copy-documents";
import type { EveCopyPlan } from "./copy-journal-contract";
import {
  eveCopyInlineAttachments,
  materializeEveCopyTranscript,
  type prepareEveCopyTranscript,
} from "./copy-transcript";

/** Input is an authorized public projection and ancestry, never browser-supplied content. */
export async function prepareEveCopyPlan(
  projection: ReturnType<typeof prepareEveCopyTranscript>,
  documents: Parameters<typeof prepareEveCopyDocuments>[0],
  readPublicFile: (key: string) => Promise<Blob>,
  origin: string
): Promise<EveCopyPlan> {
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
    const source = await readPublicFile(key);
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
}
