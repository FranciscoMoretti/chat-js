/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named artifactKinds API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const artifactKinds = ["text", "code", "sheet"] as const;
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named ArtifactKind API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ArtifactKind = (typeof artifactKinds)[number];
/* oxlint-enable import/no-named-export */
