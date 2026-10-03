import { afterEach, expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import pathModule from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
import { validateCustomToolKeys } from "./custom-tool-keys";

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { join } = pathModule;

const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
const definition = toolDefinitionSchema.parse({
  contractVersion: 1,
  id: "research",
  kind: "tool",
  tools: [{ toolExport: "research", workflow: true }],
});

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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
/* oxlint-enable oxc/no-async-await */
