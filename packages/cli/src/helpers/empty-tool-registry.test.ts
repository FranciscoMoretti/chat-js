import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import ts from "typescript";

import { scaffoldFromTemplate } from "./scaffold";

test("a fresh app can type-check its renderer boundary with no optional tools", async () => {
  const destination = await mkdtemp(
    nodePath.join(tmpdir(), "chatjs-empty-renderers-")
  );
  try {
    await scaffoldFromTemplate(destination);
    const chatApp = nodePath.resolve(import.meta.dir, "../../../../apps/chat");
    const dependencyPaths = createRequire(
      nodePath.join(chatApp, "package.json")
    ).resolve.paths("react");
    const nodeModules = dependencyPaths?.find((candidate) =>
      existsSync(nodePath.join(candidate, "react", "package.json"))
    );
    if (!nodeModules) {
      throw new Error("Could not locate the ChatJS app dependencies.");
    }
    await symlink(
      nodeModules,
      nodePath.join(destination, "node_modules"),
      "dir"
    );
    const configPath = nodePath.join(destination, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      destination
    );
    const program = ts.createProgram(
      [
        nodePath.join(destination, "lib/ai/tool-renderer-registry.ts"),
        nodePath.join(destination, "components/eve/eve-tool-result.tsx"),
      ],
      { ...parsed.options, incremental: false }
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(
      diagnostics.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
    ).toEqual([]);
  } finally {
    await rm(destination, { force: true, recursive: true });
  }
}, 30_000);
