import type { EveChannelInput } from "eve/channels/eve";

type EveCopySeed = NonNullable<
  Awaited<ReturnType<NonNullable<EveChannelInput["resolveSeed"]>>>
>;

/** Server-prepared immutable intent. Never accept this payload from a browser. */
interface EveCopyPlan {
  readonly seed: EveCopySeed;
  readonly documentCheckpoints: readonly {
    readonly messageIndex: number;
    readonly heads: readonly {
      readonly documentId: string;
      readonly revisionId: string;
    }[];
  }[];
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
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveCopyPlan, EveCopySeed); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveCopyPlan, EveCopySeed };
/* oxlint-enable import/no-named-export */
