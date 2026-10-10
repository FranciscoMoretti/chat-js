import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves installed packages from their declaring workspace using native module resolution.
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture inspects project files using native filesystem APIs.
import { existsSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import nodePath from "node:path";

import { scaffoldFromTemplate } from "./scaffold";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";

import ts from "typescript";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

const emptyToolRegistryTypecheckTimeoutMs = 30_000;

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
test(
  "a fresh app can type-check its renderer boundary with no optional tools",
  async () => {
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
      const chatApp = nodePath.resolve(
        import.meta.dir,
        "../../../../apps/chat"
      );
      const appRequire = createRequire(nodePath.join(chatApp, "package.json"));
      const dependencyPaths = appRequire.resolve.paths("react");
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading find from dependencyPaths; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
      // oxlint-disable-next-line typescript/unbound-method -- TypeScript 6.0.2's native sys.readFile closes over its filesystem implementation and never reads this; readConfigFile accepts and invokes it as a standalone reader.
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
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing parsed.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        diagnostics.map(
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- flattenDiagnosticMessageText requires the original recursive DiagnosticMessageChain; a deeply readonly diagnostic fails its native TypeScript receiver.
          (diagnostic) =>
            ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
        )
      ).toEqual([]);
    } finally {
      await rm(destination, { force: true, recursive: true });
    }
  },
  emptyToolRegistryTypecheckTimeoutMs
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
