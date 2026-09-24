import type { snapshotPublicEveCopyDocuments } from "../db/eve-copy-documents";
import { eveCopyResources, rewriteEveCopyResources } from "./copy-transcript";

/** Convert only an authorized ancestry snapshot; imported revisions have no source execution turns. */
export const prepareEveCopyDocuments = (
  snapshot: Awaited<
    ReturnType<typeof snapshotPublicEveCopyDocuments>
  >["documents"],
  allocations: Parameters<typeof rewriteEveCopyResources>[1]
) => {
  for (const document of snapshot) {
    const revisionIds = new Set<string>();
    let parent: string | null = null;
    if (!allocations.documents.has(document.documentId)) {
      throw new Error("Missing copied document allocation.");
    }
    for (const revision of document.revisions) {
      if (
        revision.documentId !== document.documentId ||
        revision.parentRevisionId !== parent ||
        revisionIds.has(revision.id) ||
        !allocations.revisions.has(revision.id)
      ) {
        throw new Error("Document copy needs complete, allocated ancestry.");
      }
      revisionIds.add(revision.id);
      parent = revision.id;
    }
    if (parent === null || parent !== document.headRevisionId) {
      throw new Error("Document copy head does not match its ancestry.");
    }
  }
  const copied = rewriteEveCopyResources(snapshot, allocations, true);
  return copied.map((document) => ({
    ...document,
    revisions: document.revisions.map((revision) => ({
      ...revision,
      operationId: `copy:${revision.id}`,
      turnIndex: null,
    })),
  }));
};

/** Inventory every accessible revision, including files removed from the current head. */
export const eveCopyDocumentResources = (
  snapshot: Awaited<
    ReturnType<typeof snapshotPublicEveCopyDocuments>
  >["documents"]
) => {
  const files = new Set<string>();
  const documents = new Set<string>();
  const revisions = new Set<string>();
  for (const document of snapshot) {
    documents.add(document.documentId);
    for (const revision of document.revisions) {
      revisions.add(revision.id);
      for (const key of eveCopyResources(revision).fileKeys) {
        files.add(key);
      }
    }
  }
  return {
    documentIds: [...documents].toSorted(),
    fileKeys: [...files].toSorted(),
    revisionIds: [...revisions].toSorted(),
  };
};
