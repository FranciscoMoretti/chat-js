import { existsSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { toolDefinitionSchema } from "../../../registry/metadata";
import {
  researchAgentFiles,
  researchAgentDirectories,
} from "../../../registry/src/tools/research";
import { itemAddress, readItem } from "../registry/shadcn";
import { preflight } from "../utils/preflight";
import { researchTestFiles } from "./scaffold-content";

const tokens = (source: string): string => {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
  scanner.setText(source);
  const result: string[] = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    result.push(scanner.getTokenText());
  }
  return JSON.stringify(result);
};

export const removeClonedResearch = async (cwd: string): Promise<void> => {
  const bundleDirectory = "tools/chatjs/deep-research";
  const descriptor = `${bundleDirectory}/chatjs.json`;
  if (!existsSync(path.join(cwd, descriptor))) {
    return;
  }
  await preflight(cwd, [
    descriptor,
    ...researchAgentFiles,
    ...researchTestFiles,
  ]);
  const definition = toolDefinitionSchema.parse(
    JSON.parse(await readFile(path.join(cwd, descriptor), "utf-8"))
  );
  if (
    definition.id !== "deep-research" ||
    !definition.tools.some(
      (tool) => tool.toolExport === "deepResearch" && tool.workflow
    )
  ) {
    throw new Error(
      "Cannot replace an unrecognized deep-research bundle in the cloned repository."
    );
  }
  await Promise.all(
    researchAgentDirectories.map(async (directory) => {
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
        if (!entry.isDirectory() && !researchAgentFiles.includes(relative)) {
          throw new Error(
            `Cloned research directory contains custom source: ${relative}. Preserve it before scaffolding.`
          );
        }
      }
    })
  );
  const item = await readItem(itemAddress("deep-research", "tool"), cwd);
  // Check every owned entry before deleting anything. Formatting changes are fine;
  // customized agents must be preserved and explicitly reconciled by their owner.
  await Promise.all(
    researchAgentFiles.map(async (file) => {
      if (!existsSync(path.join(cwd, file))) {
        return;
      }
      const expected = item.files?.find(
        (entry) => entry.target === `~/${file}`
      )?.content;
      const actual = await readFile(path.join(cwd, file), "utf-8");
      if (!expected || tokens(actual) !== tokens(expected)) {
        throw new Error(
          `Cloned research agent ${file} was customized. Preserve it and reconcile the research bundle before scaffolding.`
        );
      }
    })
  );
  await Promise.all(
    [...researchAgentFiles, ...researchTestFiles].map((file) =>
      rm(path.join(cwd, file), { force: true })
    )
  );
  await Promise.all(
    researchAgentDirectories.map((directory) =>
      rm(path.join(cwd, directory), { force: true, recursive: true })
    )
  );
  await rm(path.join(cwd, bundleDirectory), { recursive: true });
};
