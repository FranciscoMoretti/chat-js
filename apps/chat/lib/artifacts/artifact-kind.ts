export const artifactKinds = ["text", "code", "sheet"] as const;
export type ArtifactKind = (typeof artifactKinds)[number];
