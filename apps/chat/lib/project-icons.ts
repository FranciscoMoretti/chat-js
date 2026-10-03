/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): PROJECT_ICONS stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named PROJECT_ICONS API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
// Subset of Lucide icons suitable for projects
export const PROJECT_ICONS = [
  "folder",
  "briefcase",
  "book",
  "code",
  "dollar-sign",
  "graduation-cap",
  "heart",
  "home",
  "lightbulb",
  "music",
  "pencil",
  "plane",
  "shopping-cart",
  "star",
  "target",
  "users",
  "zap",
  "coffee",
  "camera",
  "globe",
  "flask",
  "chart-bar",
  "calendar",
  "clipboard",
  "rocket",
] as const;
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): ProjectIconName stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ProjectIconName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ProjectIconName = (typeof PROJECT_ICONS)[number];
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): PROJECT_COLORS stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named PROJECT_COLORS API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const PROJECT_COLORS = [
  { name: "gray", value: "#6b7280" },
  { name: "red", value: "#ef4444" },
  { name: "orange", value: "#f97316" },
  { name: "yellow", value: "#eab308" },
  { name: "green", value: "#22c55e" },
  { name: "cyan", value: "#06b6d4" },
  { name: "blue", value: "#3b82f6" },
  { name: "purple", value: "#a855f7" },
  { name: "pink", value: "#ec4899" },
] as const;
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): ProjectColorName stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ProjectColorName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ProjectColorName = (typeof PROJECT_COLORS)[number]["name"];
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable id-length, import/group-exports, import/no-named-export --
 * id-length (#506): PROJECT_COLOR_NAMES uses c as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): PROJECT_COLOR_NAMES stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named PROJECT_COLOR_NAMES API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
// For zod enum validation
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The nonempty project color catalog is mapped into a tuple needed by schema construction; Array.map loses that tuple guarantee.
export const PROJECT_COLOR_NAMES = PROJECT_COLORS.map(
  (c) => c.name
) as unknown as readonly [ProjectColorName, ...ProjectColorName[]];
/* oxlint-enable id-length, import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): DEFAULT_PROJECT_ICON stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DEFAULT_PROJECT_ICON API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const DEFAULT_PROJECT_ICON: ProjectIconName = "folder";
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): DEFAULT_PROJECT_COLOR stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named DEFAULT_PROJECT_COLOR API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const DEFAULT_PROJECT_COLOR: ProjectColorName = "gray";
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable id-length, import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-optional-chaining --
 * id-length (#506): getColorValue uses c as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): getColorValue stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getColorValue API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getColorValue uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-optional-chaining (#542): getColorValue handles optional PROJECT_COLORS.find((c) => c.name === name)?.value without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
export const getColorValue = (name: ProjectColorName): string =>
  PROJECT_COLORS.find((c) => c.name === name)?.value ?? PROJECT_COLORS[0].value;
/* oxlint-enable id-length, import/group-exports, import/no-named-export, no-magic-numbers, oxc/no-optional-chaining */
