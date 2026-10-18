import type { EveCopySeed } from "./copy-seed";

/** Server-prepared immutable intent. Never accept this payload from a browser. */
interface EveCopyPlan {
  readonly seed: EveCopySeed;
  readonly sourceHeads: readonly {
    readonly documentId: string;
    readonly revisionId: string;
  }[];
  readonly files: readonly {
    readonly key: string;
    readonly source:
      | {
          readonly kind: "stored";
          readonly key: string;
        }
      | {
          readonly kind: "inline";
          readonly base64: string;
        };
    readonly sha256: string;
    readonly size: number;
    readonly mediaType: string;
  }[];
  readonly documents: readonly {
    readonly documentId: string;
    readonly headRevisionId: string;
    readonly revisions: readonly {
      readonly id: string;
      readonly parentRevisionId: string | null;
      readonly title: string;
      readonly content: string;
      readonly fileIds: readonly string[];
      readonly kind: "text" | "code" | "sheet";
      readonly createdAt: string;
    }[];
  }[];
}
export type { EveCopyPlan };
