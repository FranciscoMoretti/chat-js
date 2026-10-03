/* oxlint-disable import/no-default-export, import/no-relative-parent-imports --
 * import/no-default-export (#526): Preserve the existing export from "../../../../agent/channels/eve" import contract; converting its consumers requires a public module API migration.
 * import/no-relative-parent-imports (#530): Keep the explicit "../../../../agent/channels/eve" dependency within this package instead of introducing an alias or barrel API.
 */
// Keep the fixture filename because Eve uses filenames as public names.
// biome-ignore-all lint/style/useFilenamingConvention: Eve uses filenames as public names.
// biome-ignore lint/performance/noBarrelFile: The fixture must exercise the exact production channel/tool definition.
export { default } from "../../../../agent/channels/eve";
/* oxlint-enable import/no-default-export, import/no-relative-parent-imports */
