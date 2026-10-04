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

// For zod enum validation
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: The nonempty project color catalog is mapped into a tuple needed by schema construction; Array.map loses that tuple guarantee.
const PROJECT_COLOR_NAMES = PROJECT_COLORS.map(
  (color) => color.name
) as unknown as readonly [ProjectColorName, ...ProjectColorName[]];

const DEFAULT_PROJECT_ICON: ProjectIconName = "folder";

const DEFAULT_PROJECT_COLOR: ProjectColorName = "gray";

/* oxlint-disable no-magic-numbers --
no-magic-numbers (#517): getColorValue uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
const getColorValue = (name: ProjectColorName): string =>
  PROJECT_COLORS.find((color) => color.name === name)?.value ??
  PROJECT_COLORS[0].value;
/* oxlint-enable no-magic-numbers */
export {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  getColorValue,
  PROJECT_COLOR_NAMES,
  PROJECT_COLORS,
  PROJECT_ICONS,
};
export type { ProjectColorName, ProjectIconName };
