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

export type ProjectIconName = (typeof PROJECT_ICONS)[number];

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

export type ProjectColorName = (typeof PROJECT_COLORS)[number]["name"];

// For zod enum validation
export const PROJECT_COLOR_NAMES = PROJECT_COLORS.map(
  (c) => c.name
) as unknown as readonly [ProjectColorName, ...ProjectColorName[]];

export const DEFAULT_PROJECT_ICON: ProjectIconName = "folder";
export const DEFAULT_PROJECT_COLOR: ProjectColorName = "gray";

export const getColorValue = (name: ProjectColorName): string =>
  PROJECT_COLORS.find((c) => c.name === name)?.value ?? PROJECT_COLORS[0].value;
