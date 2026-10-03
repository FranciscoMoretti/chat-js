import type { EveChannelInput } from "eve/channels/eve";

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): EveCopySeed stays exported at its declaration so its public contract is visible beside its implementation.
 */
export type EveCopySeed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/consistent-type-definitions --
 * import/group-exports (#523): EveCopyPlan stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/consistent-type-definitions (#559): EveCopyPlan preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
/** Server-prepared immutable intent. Never accept this payload from a browser. */
export type EveCopyPlan = {
  seed: EveCopySeed;
  documentCheckpoints: {
    messageIndex: number;
    heads: { documentId: string; revisionId: string }[];
  }[];
  sourceHeads: { documentId: string; revisionId: string }[];
  files: {
    key: string;
    source:
      | { kind: "stored"; key: string }
      | { kind: "inline"; base64: string };
    sha256: string;
    size: number;
    mediaType: string;
  }[];
  documents: {
    documentId: string;
    headRevisionId: string;
    revisions: {
      id: string;
      parentRevisionId: string | null;
      title: string;
      content: string;
      fileIds: string[];
      kind: "text" | "code" | "sheet";
      createdAt: string;
    }[];
  }[];
};
/* oxlint-enable import/group-exports, typescript/consistent-type-definitions */
