import { afterEach, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import pathModule from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
import { validateCustomToolKeys } from "./custom-tool-keys";

const roots: string[] = [];
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map(async (root) => await rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable eslint/no-magic-numbers */
const definition = toolDefinitionSchema.parse({
  contractVersion: 1,
  id: "research",
  kind: "tool",
  tools: [{ toolExport: "research", workflow: true }],
});

const validationFailure = async (root: string): Promise<string> => {
  try {
    await validateCustomToolKeys(root, [definition]);
    return "Validation unexpectedly succeeded";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
};

test("preflight finds imported and spread keys without executing source", async () => {
  const root = await mkdtemp(pathModule.join(tmpdir(), "chatjs-custom-keys-"));
  roots.push(root);
  const directory = pathModule.join(root, "tools/chatjs");
  await mkdir(directory, { recursive: true });
  await writeFile(
    pathModule.join(directory, "shared.ts"),
    'throw new Error("must not execute"); export const shared = {research: {}};'
  );
  await writeFile(
    pathModule.join(directory, "custom-tools.ts"),
    'import {shared} from "./shared"; export const customTools = {...shared};'
  );
  expect(await validationFailure(root)).toContain("Custom tools conflict");
  await validateCustomToolKeys(root, []);
});

test("preflight rejects dynamic keys it cannot verify", async () => {
  const root = await mkdtemp(pathModule.join(tmpdir(), "chatjs-custom-keys-"));
  roots.push(root);
  const directory = pathModule.join(root, "tools/chatjs");
  await mkdir(directory, { recursive: true });
  await writeFile(
    pathModule.join(directory, "custom-tools.ts"),
    "declare const name: string; export const customTools = {[name]: {}};"
  );
  expect(await validationFailure(root)).toContain(
    "Cannot determine customTools keys"
  );
});
