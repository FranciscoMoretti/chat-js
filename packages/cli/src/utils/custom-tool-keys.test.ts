import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import pathModule from "node:path";
import { tmpdir } from "node:os";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { validateCustomToolKeys } from "./custom-tool-keys";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
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
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
};
test("preflight finds imported and spread keys without executing source", async () => {
  const root = await mkdtemp(pathModule.join(tmpdir(), "chatjs-custom-keys-"));
  roots.push(root);
  const directory = pathModule.join(root, "composition/custom");
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
  const directory = pathModule.join(root, "composition/custom");
  await mkdir(directory, { recursive: true });
  await writeFile(
    pathModule.join(directory, "custom-tools.ts"),
    "declare const name: string; export const customTools = {[name]: {}};"
  );
  expect(await validationFailure(root)).toContain(
    "Cannot determine customTools keys"
  );
});
