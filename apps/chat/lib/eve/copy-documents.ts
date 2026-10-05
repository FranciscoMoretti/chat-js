import type { snapshotPublicEveCopyDocuments } from "@/lib/db/eve-copy-documents";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { eveCopyResources, rewriteEveCopyResources } from "./copy-transcript";
/* oxlint-enable sort-imports */

const ALLOCATIONS_PARAMETER_INDEX = 1;
type CopyDocumentSnapshot = Awaited<
  ReturnType<typeof snapshotPublicEveCopyDocuments>
>["documents"];
type PreparedCopyDocument = Omit<CopyDocumentSnapshot[number], "revisions"> & {
  revisions: (Omit<
    CopyDocumentSnapshot[number]["revisions"][number],
    "operationId" | "turnIndex"
  > & {
    operationId: string;
    turnIndex: null;
  })[];
};

/* oxlint-disable max-statements, typescript/prefer-readonly-parameter-types, unicorn/no-null --max-statements (#512): prepareEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): prepareEveCopyDocuments retains mutable snapshot and allocation views; readonly projection changes copied revision fileIds output mutability, so this scope remains unreviewed.
unicorn/no-null (#570): prepareEveCopyDocuments preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Converts an authorized, completely allocated ancestry into idle imported revisions.
 * @param {CopyDocumentSnapshot} snapshot Accessible document heads and their complete root-to-head revisions.
 * @param {Parameters< typeof rewriteEveCopyResources >[typeof ALLOCATIONS_PARAMETER_INDEX]} allocations Ownership-checked destination document, revision, and file allocations.
 * @returns {PreparedCopyDocument[]} Copied documents with rewritten identities and idle copy operations; incomplete ancestry throws.
 */
const prepareEveCopyDocuments = (
  snapshot: CopyDocumentSnapshot,
  allocations: Parameters<
    typeof rewriteEveCopyResources
  >[typeof ALLOCATIONS_PARAMETER_INDEX]
): PreparedCopyDocument[] => {
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
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Decorate copied document revisions without mutating resource-rewrite results.
  return copied.map((document) => ({
    ...document,
    revisions: document.revisions.map((revision) => ({
      ...revision,
      operationId: `copy:${revision.id}`,
      turnIndex: null,
    })),
  }));
};
/* oxlint-enable max-statements, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/**
 * Inventories every accessible revision, including files removed from the current head.
 * @param {ReadonlyNativeSurface<CopyDocumentSnapshot>} snapshot Authorized document ancestry whose historical file references must remain available.
 * @returns {ReturnType<typeof eveCopyResources>} Sorted unique file keys, document IDs, and revision IDs across the entire snapshot.
 */
const eveCopyDocumentResources = (
  snapshot: ReadonlyNativeSurface<CopyDocumentSnapshot>
): ReturnType<typeof eveCopyResources> => {
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

export { eveCopyDocumentResources, prepareEveCopyDocuments };
