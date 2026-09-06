// Selected local source. An external catalog can replace this module.
export const models = [
	{ id: "fast", label: "Fast" },
	{ id: "careful", label: "Careful" },
] as const;
export type ModelId = (typeof models)[number]["id"];
export const defaultModel: ModelId = "fast";
