import type { EveChannelInput } from "eve/channels/eve";

export type EveCopySeed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;

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
