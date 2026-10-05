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

const [fallbackProjectColor, ...additionalProjectColors] = PROJECT_COLORS;

// For zod enum validation
const PROJECT_COLOR_NAMES = [
  fallbackProjectColor.name,
  ...additionalProjectColors.map((color) => color.name),
] as const;

const DEFAULT_PROJECT_ICON: ProjectIconName = "folder";

const DEFAULT_PROJECT_COLOR: ProjectColorName = "gray";

const getColorValue = (name: ProjectColorName): string =>
  PROJECT_COLORS.find((color) => color.name === name)?.value ??
  fallbackProjectColor.value;
export {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
  getColorValue,
  PROJECT_COLOR_NAMES,
  PROJECT_COLORS,
  PROJECT_ICONS,
};
export type { ProjectColorName, ProjectIconName };
