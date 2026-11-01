import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseJsonObject } from "#cli/helpers/json-object";
import { preflight } from "./preflight";

export const readUiBase = async (
  cwd: string
): Promise<"base" | "radix" | undefined> => {
  await preflight(cwd, ["components.json"]);
  const content = await readFile(
    path.join(cwd, "components.json"),
    "utf-8"
  ).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "{}";
    }
    throw error;
  });
  const { style } = parseJsonObject(content, "components.json");
  if (typeof style !== "string") {
    return undefined;
  }
  if (style.startsWith("base-")) {
    return "base";
  }
  if (style.startsWith("radix-")) {
    return "radix";
  }
  return undefined;
};

export const assertUiCompatibility = async (
  cwd: string,
  items: readonly Readonly<{ id: string; uiBase?: "base" | "radix" }>[]
): Promise<void> => {
  const requiringBase = items.filter((item) => item.uiBase !== undefined);
  if (requiringBase.length === 0) {
    return;
  }
  const base = await readUiBase(cwd);
  const incompatible = requiringBase.filter((item) => item.uiBase !== base);
  if (incompatible.length > 0) {
    throw new Error(
      `${incompatible.map((item) => `${item.id} (${item.uiBase})`).join(", ")} requires a matching ChatJS UI migration. This app uses ${base ?? "an unknown UI base"}. Keep its compatible registry namespace, or migrate primitives and their callers together. Changing components.json alone is not a migration. No source or registrations were written.`
    );
  }
};
