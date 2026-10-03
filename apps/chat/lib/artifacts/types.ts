import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): ArtifactMetadata stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ArtifactMetadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ArtifactMetadata = object | null;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): UIArtifact stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named UIArtifact API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface UIArtifact {
  content: string;
  conversationId?: string;
  followLive?: boolean;
  previewCallId?: string;
  date?: string;
  documentId: string;
  isVisible: boolean;
  kind: ArtifactKind;
  messageId: string;
  revisionId?: string;
  status: "streaming" | "idle";
  title: string;
}
/* oxlint-enable import/group-exports */
