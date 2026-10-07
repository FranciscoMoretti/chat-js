/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (artifactKinds); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const artifactKinds = ["text", "code", "sheet"] as const;
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ArtifactKind); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type ArtifactKind = (typeof artifactKinds)[number];
/* oxlint-enable import/no-named-export */
