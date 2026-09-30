import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { itemAddress, readItem } from "../registry/shadcn";
import { preflight } from "./preflight";

const tokens = (source: string): string => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
  scanner.setText(source);
  const result: string[] = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    result.push(scanner.getTokenText());
  }
  return JSON.stringify(result);
};

export const validateClonedBundle = async (
  cwd: string,
  bundleDirectory: string,
  extraDirectories: string[] = []
): Promise<void> => {
  const descriptor = `${bundleDirectory}/chatjs.json`;
  await preflight(cwd, [descriptor]);
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(path.join(cwd, descriptor), "utf-8"))
  );
  const item = await readItem(itemAddress(definition.id, "tool"), cwd);
  if (
    JSON.stringify(definition) !==
    JSON.stringify(toolDefinitionSchema.parse(item.meta?.chatjs))
  ) {
    throw new Error(
      "Cloned tool descriptor was customized. Preserve it before scaffolding."
    );
  }
  const ownedFiles = (item.files ?? []).filter((file) =>
    file.target?.startsWith("~/")
  );
  const ownedPaths = ownedFiles.map((file) => file.target?.slice(2));
  await preflight(
    cwd,
    ownedPaths.filter((file) => file !== undefined)
  );
  await Promise.all(
    [bundleDirectory, ...extraDirectories].map(async (directory) => {
      if (!existsSync(path.join(cwd, directory))) {
        return;
      }
      const entries = await readdir(path.join(cwd, directory), {
        recursive: true,
        withFileTypes: true,
      });
      for (const entry of entries) {
        const relative = path
          .relative(cwd, path.join(entry.parentPath, entry.name))
          .split(path.sep)
          .join("/");
        if (
          !entry.isDirectory() &&
          relative !== descriptor &&
          !ownedPaths.includes(relative)
        ) {
          throw new Error(
            `Cloned tool directory contains custom source: ${relative}. Preserve it before scaffolding.`
          );
        }
      }
    })
  );
  // Check every owned entry before deleting anything. Formatting changes are fine;
  // customized source must be preserved and explicitly reconciled by its owner.
  await Promise.all(
    ownedFiles.map(async (entry) => {
      const file = entry.target?.slice(2);
      if (!file) {
        return;
      }
      if (!existsSync(path.join(cwd, file))) {
        return;
      }
      const expected = entry.content;
      const actual = await readFile(path.join(cwd, file), "utf-8");
      if (!expected || tokens(actual) !== tokens(expected)) {
        throw new Error(
          `Cloned tool source ${file} was customized. Preserve it and reconcile the tool bundle before scaffolding.`
        );
      }
    })
  );
};
