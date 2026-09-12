import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { registry } from "../registry";

// The reference app intentionally uses the uncustomized published source.
// A deliberate customization should be recorded here with its reason.
const referenceItems = new Set([
  "vercel-gateway",
  "word-count",
  "get-weather",
  "retrieve-url",
  "toolkit-renderer",
]);
const packageRoot = path.resolve(import.meta.dir, "..");
function emitted(source: string, fileName: string) {
  return ts
    .transpileModule(source, {
      fileName,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
        jsx: ts.JsxEmit.Preserve,
        removeComments: true,
      },
    })
    .outputText.trim();
}

test("reference consumer stays aligned with canonical registry source", async () => {
  for (const item of registry.items.filter((registryItem) =>
    referenceItems.has(registryItem.name)
  )) {
    for (const file of item.files ?? []) {
      if (!file.target) {
        throw new Error("Reference files need explicit targets");
      }
      const source = await readFile(
        path.resolve(packageRoot, file.path),
        "utf-8"
      );
      const installed = await readFile(
        path.resolve(
          packageRoot,
          "../../apps/chat",
          file.target.replace(/^~\//u, "")
        ),
        "utf-8"
      );
      expect(emitted(installed, file.path)).toBe(emitted(source, file.path));
    }
  }
});
