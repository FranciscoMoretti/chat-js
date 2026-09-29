import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { validateCustomToolKeys } from "./custom-tool-keys";

const { join } = pathModule;

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
const definition = toolDefinitionSchema.parse({
  contractVersion: 1,
  id: "research",
  kind: "tool",
  tools: [{ toolExport: "research", workflow: true }],
});

test("preflight finds imported and spread keys without executing source", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-custom-keys-"));
  roots.push(root);
  const directory = join(root, "tools/chatjs");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "shared.ts"),
    'throw new Error("must not execute"); export const shared = {research: {}};'
  );
  await writeFile(
    join(directory, "custom-tools.ts"),
    'import {shared} from "./shared"; export const customTools = {...shared};'
  );
  expect(() => validateCustomToolKeys(root, [definition])).toThrow(
    "Custom tools conflict"
  );
  expect(() => validateCustomToolKeys(root, [])).not.toThrow();
});

test("preflight rejects dynamic keys it cannot verify", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-custom-keys-"));
  roots.push(root);
  const directory = join(root, "tools/chatjs");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "custom-tools.ts"),
    "declare const name: string; export const customTools = {[name]: {}};"
  );
  expect(() => validateCustomToolKeys(root, [definition])).toThrow(
    "Cannot determine customTools keys"
  );
});
