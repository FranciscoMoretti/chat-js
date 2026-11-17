import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { parseAgentRecipe, recipePath, writeAgentRecipe } from "./agent-recipe";

// A fresh scaffold exports known public sources, never local credentials or later edits.
test("recipes retain exact native source and reject changed payloads, missing locks and traversal", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-recipe-test-"));
  try {
    await Promise.all(
      ["components/ui", "app", "lib"].map(async (folder) => {
        await mkdir(path.join(directory, folder), { recursive: true });
      })
    );
    const files = [
      "components.json",
      "package.json",
      "bun.lock",
      "app/globals.css",
      "app/layout.tsx",
      "lib/utils.ts",
      "components/ui/button.tsx",
    ];
    await Promise.all(
      files.map(async (file) => {
        await writeFile(path.join(directory, file), `original ${file}`);
      })
    );
    await writeFile(
      path.join(directory, ".env.local"),
      "PRIVATE_API_KEY=secret-value"
    );
    await writeAgentRecipe(directory, {
      selection: { plugins: [], tools: [] },
      appearance: ["--preset", "rhea"],
      capabilities: [],
    });
    const source = await readFile(path.join(directory, recipePath), "utf-8");
    const recipe = parseAgentRecipe(JSON.parse(source));
    expect(source).not.toContain("secret-value");
    expect(recipe.native.map((file) => file.path).toSorted()).toEqual(
      files.toSorted()
    );
    expect(() =>
      parseAgentRecipe({
        ...recipe,
        native: recipe.native.filter((file) => file.path !== "bun.lock"),
      })
    ).toThrow("missing bun.lock");
    expect(() =>
      parseAgentRecipe({
        ...recipe,
        native: recipe.native.map((file) => ({ ...file, content: "changed" })),
      })
    ).toThrow("changed");
    expect(() =>
      parseAgentRecipe({
        ...recipe,
        native: [
          { ...recipe.native[0], path: "components/ui/../../escape.tsx" },
        ],
      })
    ).toThrow("Invalid native scaffold path");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
