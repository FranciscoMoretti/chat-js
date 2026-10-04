import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import ts from "typescript";

import { scaffoldFromTemplate } from "./scaffold";

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("a fresh app can type-check its renderer boundary with no optional tools", async () => {
  const destination = await mkdtemp(
    nodePath.join(tmpdir(), "chatjs-empty-renderers-")
  );
  try {
    await scaffoldFromTemplate(destination);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(
      await readFile(nodePath.join(destination, "package.json"), "utf-8")
    );
    for (const dependency of [
      "@lexical/markdown",
      "codemirror",
      "papaparse",
      "react-data-grid",
    ]) {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies[dependency]).toBeUndefined();
    }
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(manifest.dependencies.lexical).toBeDefined();
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(manifest.dependencies["@lexical/react"]).toBeDefined();
    const chatApp = nodePath.resolve(import.meta.dir, "../../../../apps/chat");
    const appRequire = createRequire(nodePath.join(chatApp, "package.json"));
    const dependencyPaths = appRequire.resolve.paths("react");
    const nodeModules = dependencyPaths?.find((candidate) =>
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
    // oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
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
}, 30_000);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
