import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

type ArtifactMetadata = object | null;

interface UIArtifact {
  readonly content: string;
  readonly conversationId?: string;
  readonly followLive?: boolean;
  readonly previewCallId?: string;
  readonly date?: string;
  readonly documentId: string;
  readonly isVisible: boolean;
  readonly kind: ArtifactKind;
  readonly messageId: string;
  readonly revisionId?: string;
  readonly status: "streaming" | "idle";
  readonly title: string;
}
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ArtifactMetadata, UIArtifact); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ArtifactMetadata, UIArtifact };
/* oxlint-enable import/no-named-export */
