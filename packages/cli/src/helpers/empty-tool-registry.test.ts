import { expect, test } from "bun:test";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import ts from "typescript";

import { scaffoldFromTemplate } from "./scaffold";

test("a fresh app can type-check its renderer boundary with no optional tools", async () => {
  const destination = await mkdtemp(join(tmpdir(), "chatjs-empty-renderers-"));
  try {
    await scaffoldFromTemplate(destination);
    await symlink(
      resolve(import.meta.dir, "../../../../node_modules"),
      join(destination, "node_modules"),
      "dir"
    );
    const configPath = join(destination, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      destination
    );
    const program = ts.createProgram(
      [
        join(destination, "lib/ai/tool-renderer-registry.ts"),
        join(destination, "components/eve/eve-tool-result.tsx"),
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
    await rm(destination, { recursive: true, force: true });
  }
}, 30_000);
