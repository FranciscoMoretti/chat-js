import brandIcons from "./capability-icons.json";

export const createSymbols = [
  "cpu",
  "database",
  "minus",
  "plug",
  "route",
  "monitor",
] as const;
export type CreateSymbol = (typeof createSymbols)[number];
export type CreateIcon = keyof typeof brandIcons | CreateSymbol;

export const isCreateIcon = (value: unknown): value is CreateIcon =>
  typeof value === "string" &&
  (Object.hasOwn(brandIcons, value) ||
    createSymbols.some((symbol) => symbol === value));
