// Subset of Lucide icons suitable for projects
const PROJECT_ICONS = [
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

type ProjectIconName = (typeof PROJECT_ICONS)[number];

const PROJECT_COLORS = [
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

type ProjectColorName = (typeof PROJECT_COLORS)[number]["name"];

const [fallbackProjectColor] = PROJECT_COLORS;

// For zod enum validation
const PROJECT_COLOR_NAMES = PROJECT_COLORS.map((color) => color.name);

const DEFAULT_PROJECT_ICON: ProjectIconName = "folder";

const DEFAULT_PROJECT_COLOR: ProjectColorName = "gray";

// Saved varchar values can outlive the installed icon/color catalog. Keep the
// same folder/gray fallback used by ProjectIcon when opening the editor.
const getProjectIconName = (value: string): ProjectIconName =>
  PROJECT_ICONS.find((icon) => icon === value) ?? DEFAULT_PROJECT_ICON;
const getProjectColorName = (value: string): ProjectColorName =>
  PROJECT_COLOR_NAMES.find((color) => color === value) ?? DEFAULT_PROJECT_COLOR;

const getColorValue = (name: ProjectColorName): string =>
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading value from PROJECT_COLORS.find(...); preserve one receiver evaluation, skipped accesses and the existing fallbackProjectColor.value fallback. The app guidance prefers optional chaining.
  PROJECT_COLORS.find((color) => color.name === name)?.value ??
  fallbackProjectColor.value;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (DEFAULT_PROJECT_COLOR, DEFAULT_PROJECT_ICON, getColorValue, PROJECT_COLOR_NAMES, PROJECT_COLORS, PROJECT_ICONS); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  getColorValue,
  getProjectIconName,
  getProjectColorName,
  PROJECT_COLOR_NAMES,
  PROJECT_COLORS,
  PROJECT_ICONS,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ProjectColorName, ProjectIconName); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ProjectColorName, ProjectIconName };
/* oxlint-enable import/no-named-export */
