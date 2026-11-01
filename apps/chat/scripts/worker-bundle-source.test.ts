import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { hasBundledTypeScriptCompiler } from "./worker-bundle-source";

const require = createRequire(import.meta.url);

test("detects the installed compiler after bundling and minifying identifiers", () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "chatjs-compiler-content-")
  );
  try {
    const output = path.join(directory, "compiler.cjs");
    execFileSync("bun", [
      "build",
      require.resolve("typescript"),
      "--target=node",
      "--minify",
      "--outfile",
      output,
    ]);
    const source = readFileSync(output, "utf-8");
    expect(source).not.toContain("function createSourceFile(");
    expect(hasBundledTypeScriptCompiler(source)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("allows an external compiler reference without compiler content", () => {
  expect(
    hasBundledTypeScriptCompiler('const ts = require("typescript");')
  ).toBe(false);
});
