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
export type { ArtifactMetadata, UIArtifact };
