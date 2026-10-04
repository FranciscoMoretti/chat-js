/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-copy-documents" dependency within this package instead of introducing an alias or barrel API.
 */
import type { snapshotPublicEveCopyDocuments } from "../db/eve-copy-documents";
import { eveCopyResources, rewriteEveCopyResources } from "./copy-transcript";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- jsdoc/require-param (#534): prepareEveCopyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): prepareEveCopyDocuments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-statements (#512): prepareEveCopyDocuments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): prepareEveCopyDocuments uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/explicit-function-return-type (#560): Keep prepareEveCopyDocuments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep prepareEveCopyDocuments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): prepareEveCopyDocuments accepts snapshot: Awaited< ReturnType<typeof snapshotPublicEveCopyDocuments> >["documents"]; allocations: Parameters<typeof rewriteEveCopyResources>[1]; document; revision; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): prepareEveCopyDocuments preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Convert only an authorized ancestry snapshot; imported revisions have no source execution turns. */
const prepareEveCopyDocuments = (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- jsdoc/require-param (#534): eveCopyDocumentResources's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): eveCopyDocumentResources's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep eveCopyDocumentResources's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep eveCopyDocumentResources's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): eveCopyDocumentResources accepts snapshot: Awaited< ReturnType<typeof snapshotPublicEveCopyDocuments> >["documents"]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Inventory every accessible revision, including files removed from the current head. */
const eveCopyDocumentResources = (
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
export { eveCopyDocumentResources, prepareEveCopyDocuments };
