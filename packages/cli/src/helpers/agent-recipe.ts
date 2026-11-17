import { eveSourceSchema, validateEveSources } from "./eve-integrations";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import packageJson from "../../package.json";
import { installationSelectionSchema } from "../../../registry/installation";
import {
  resolvedItemSchema,
  validateResolvedItems,
} from "#cli/registry/resolved-items";
import { optionalDirectoryFiles } from "#cli/utils/installation-files";

export const recipePath = "chatjs/agent-recipe.json";
const nativePaths = new Set([
  "components.json",
  "package.json",
  "bun.lock",
  "app/globals.css",
  "app/layout.tsx",
  "lib/utils.ts",
  "hooks/use-mobile.ts",
]);
const safeNativePath = (file: string): boolean =>
  !file
    .split("/")
    .some((part) => part === ".." || part === "." || part === "") &&
  (nativePaths.has(file) ||
    /^components\/ui\/[a-zA-Z0-9_/-]+\.tsx$/u.test(file));
const fileSchema = z.strictObject({
  path: z.string().refine(safeNativePath, "Invalid native scaffold path"),
  content: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});
const recipeSchema = z.strictObject({
  version: z.literal(1),
  generator: z.literal(`chat-js@${packageJson.version}`),
  selection: installationSelectionSchema,
  appearance: z.array(z.string()),
  capabilities: z.array(resolvedItemSchema),
  native: z.array(fileSchema),
  eve: eveSourceSchema.optional(),
});
export type AgentRecipe = z.infer<typeof recipeSchema>;
const digest = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

export const parseAgentRecipe = (value: unknown): AgentRecipe => {
  const recipe = recipeSchema.parse(value);
  validateResolvedItems(recipe.capabilities);
  if ((recipe.selection.eve?.length ?? 0) > 0) {
    if ((recipe.eve?.length ?? 0) === 0) {
      throw new Error("Recipe is missing its installed EVE source.");
    }
    validateEveSources(recipe.eve);
  }
  const seen = new Set<string>();
  for (const file of recipe.native) {
    if (seen.has(file.path) || digest(file.content) !== file.sha256) {
      throw new Error(
        `Recipe source changed or duplicated: ${file.path}. Generate a new recipe explicitly.`
      );
    }
    seen.add(file.path);
  }
  for (const file of ["components.json", "package.json", "bun.lock"]) {
    if (!seen.has(file)) {
      throw new Error(
        `Recipe is missing ${file}; generation will not substitute a newer version.`
      );
    }
  }
  return recipe;
};

/** Only fresh generation writes a recipe. Developer edits and secrets are never exported. */
export const writeAgentRecipe = async (
  cwd: string,
  input: Pick<AgentRecipe, "selection" | "appearance" | "capabilities" | "eve">
): Promise<void> => {
  const files = [
    ...new Set([
      ...nativePaths,
      ...(await optionalDirectoryFiles(cwd, "components/ui")),
    ]),
  ].toSorted();
  const native = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await readFile(path.join(cwd, file), "utf-8");
        return { path: file, content, sha256: digest(content) };
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT" &&
          file === "hooks/use-mobile.ts"
        ) {
          return null;
        }
        throw error;
      }
    })
  );
  const recipe = parseAgentRecipe({
    version: 1,
    generator: `chat-js@${packageJson.version}`,
    ...input,
    native: native.filter((file) => file !== null),
  });
  await mkdir(path.join(cwd, "chatjs"), { recursive: true });
  await writeFile(
    path.join(cwd, recipePath),
    `${JSON.stringify(recipe, null, 2)}\n`
  );
};
