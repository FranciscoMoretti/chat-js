import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import nodePath from "node:path";

import { scaffoldFromTemplate } from "./scaffold";
import { parsePackageJson } from "./package-manifest";
import { requireJsonObject } from "./json-object";
import { tmpdir } from "node:os";

import ts from "typescript";

const emptyToolRegistryTypecheckTimeoutMs = 30_000;

test(
  "a fresh app can type-check its renderer boundary with no optional tools",
  async () => {
    const destination = await mkdtemp(
      nodePath.join(tmpdir(), "chatjs-empty-renderers-")
    );
    try {
      await scaffoldFromTemplate(destination);
      const manifest = parsePackageJson(
        await readFile(nodePath.join(destination, "package.json"), "utf-8")
      );
      const dependencies = requireJsonObject(
        manifest.dependencies,
        "dependencies"
      );
      for (const dependency of [
        "@lexical/markdown",
        "codemirror",
        "papaparse",
        "react-data-grid",
      ]) {
        expect(dependencies[dependency]).toBeUndefined();
      }
      expect(dependencies.lexical).toBeDefined();
      expect(dependencies["@lexical/react"]).toBeDefined();
      const chatApp = nodePath.resolve(
        import.meta.dir,
        "../../../../apps/chat"
      );
      const appRequire = createRequire(nodePath.join(chatApp, "package.json"));
      const dependencyPaths = appRequire.resolve.paths("react") ?? [];
      const nodeModules = dependencyPaths.find((candidate) =>
        existsSync(nodePath.join(candidate, "react", "package.json"))
      );
      if (!(typeof nodeModules === "string" && nodeModules !== "")) {
        throw new Error("Could not locate the ChatJS app dependencies.");
      }
      await symlink(
        nodeModules,
        nodePath.join(destination, "node_modules"),
        "dir"
      );
      const configPath = nodePath.join(destination, "tsconfig.json");
      const config = ts.readConfigFile(configPath, (file) =>
        ts.sys.readFile(file)
      );
      const parsed = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        destination
      );
      const program = ts.createProgram(
        [
          nodePath.join(destination, "lib/ai/tool-renderer-registry.ts"),
          nodePath.join(destination, "components/eve/eve-tool-result.tsx"),
          nodePath.join(destination, "components/eve/eve-document-body.tsx"),
        ],
        {
          ...parsed.options,
          incremental: false,
          // Bun can place React and Node types at different workspace levels.
          typeRoots: [
            nodePath.dirname(
              nodePath.dirname(appRequire.resolve("@types/node/package.json"))
            ),
          ],
        }
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
  },
  emptyToolRegistryTypecheckTimeoutMs
);
