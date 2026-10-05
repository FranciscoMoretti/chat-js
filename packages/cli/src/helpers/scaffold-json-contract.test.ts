import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun test uses native assertions to await rejection and verify integration contracts.
import assert from "node:assert/strict";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

import { scaffoldElectron } from "./scaffold";

const electronOptions = { projectName: "json-contract" };

test("Electron scaffolding preserves missing and syntactically invalid project manifest errors", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "scaffold-json-errors-"));
  try {
    await assert.rejects(
      scaffoldElectron(directory, electronOptions),
      /ENOENT/u
    );
    await writeFile(path.join(directory, "package.json"), "{");
    await assert.rejects(
      scaffoldElectron(directory, electronOptions),
      SyntaxError
    );
    await writeFile(path.join(directory, "package.json"), "null");
    await assert.rejects(
      scaffoldElectron(directory, electronOptions),
      TypeError
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("Electron scaffolding rejects malformed exclusions without rewriting tsconfig", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "scaffold-json-exclusions-")
  );
  const source = '{"extension":{"keep":true},"exclude":["existing",42]}';
  try {
    await writeFile(path.join(directory, "package.json"), "{}");
    await writeFile(path.join(directory, "tsconfig.json"), source);
    await assert.rejects(scaffoldElectron(directory, electronOptions), {
      message: "Project tsconfig.json exclude must be an array of strings.",
      name: "TypeError",
    });
    expect(await readFile(path.join(directory, "tsconfig.json"), "utf-8")).toBe(
      source
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
