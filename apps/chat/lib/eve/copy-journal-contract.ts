import type { EveChannelInput } from "eve/channels/eve";

type EveCopySeed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): EveCopyPlan preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
/** Server-prepared immutable intent. Never accept this payload from a browser. */
type EveCopyPlan = {
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
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveCopyPlan, EveCopySeed); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/consistent-type-definitions */
export type { EveCopyPlan, EveCopySeed };
/* oxlint-enable import/no-named-export */
