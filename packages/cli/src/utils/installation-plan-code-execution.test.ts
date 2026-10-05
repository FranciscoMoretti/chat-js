import { afterEach, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { planInstallation } from "./installation-plan";
/* oxlint-enable sort-imports */

const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots
      .splice(0)
      .map((root): Promise<void> => rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const definition = (id: string) =>
  toolDefinitionSchema.parse({
    codeExecutionCapabilities: {
      cancellation: "terminate",
      cleanup: "durable-allocation",
      files: "ephemeral",
      languages: ["python", "javascript"],
      timeout: "bounded",
      usage: "single-receipt",
    },
    codeExecutorExport: "executeCode",
    contractVersion: 1,
    id,
    kind: "tool",
    slot: "codeExecution",
    tools: [{ toolExport: "executeCode" }],
  });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("rejects conflicting provider selections and permits reinstalling the selected provider", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plan-provider-"));
  roots.push(root);
  const directory = path.join(root, "tools/chatjs/first");
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "chatjs.json"),
    JSON.stringify(definition("first"))
  );
  await writeFile(
    path.join(directory, "tool.ts"),
    "export const executeCode = {};\n"
  );
  const server = Bun.serve({
    fetch(request): Response {
      const id = new URL(request.url).pathname.includes("second")
        ? "second"
        : "first";
      return Response.json({
        meta: { chatjs: definition(id) },
        name: id,
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      planInstallation(root, {
        features: [],
        tools: [`http://127.0.0.1:${server.port}/second.json`],
      })
    ).rejects.toThrow("Only one codeExecution");
    const fresh = await planInstallation(
      root,
      {
        features: [],
        tools: [`http://127.0.0.1:${server.port}/second.json`],
      },
      { fresh: true }
    );
    expect(
      fresh.replacements.map(({ previous }): string => previous.id)
    ).toEqual([]);
    const reinstall = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/first.json`],
    });
    expect(reinstall.expected).toEqual([definition("first")]);
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-lines-per-function, eslint/max-statements -- The upgrade scenario preserves the old installed descriptor while testing both successful planning and pre-write rejection. */
/* oxlint-disable typescript/await-thenable, typescript/no-confusing-void-expression -- Bun rejection matchers are awaited despite their void declarations. */
test("replaces an older executor descriptor but rejects newly requested providers without capabilities", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-executor-upgrade-"));
  roots.push(root);
  const old = definition("previous-executor");
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding oldDescriptor excludes codeExecutionCapabilities from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  const { codeExecutionCapabilities, ...oldDescriptor } = old;
  expect(codeExecutionCapabilities).toBeDefined();
  const directory = path.join(root, "tools/chatjs/previous-executor");
  await mkdir(directory, { recursive: true });
  const installed = JSON.stringify(oldDescriptor);
  await writeFile(path.join(directory, "chatjs.json"), installed);
  await writeFile(
    path.join(directory, "tool.ts"),
    "export const executeCode = {};\n"
  );
  let declared = true;
  const server = Bun.serve({
    fetch(): Response {
      const complete = definition("next-executor");
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding incomplete excludes codeExecutionCapabilities from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
      const { codeExecutionCapabilities: capabilities, ...incomplete } =
        complete;
      return Response.json({
        meta: {
          chatjs: declared
            ? // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing incomplete own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
              { ...incomplete, codeExecutionCapabilities: capabilities }
            : incomplete,
        },
        name: complete.id,
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const selection = {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/executor.json`],
    };
    const planned = await planInstallation(root, selection, { replace: true });
    expect(
      planned.replacements.map(
        ({
          previous,
        }: Readonly<{ previous: Readonly<{ id: string }> }>): string =>
          previous.id
      )
    ).toEqual([old.id]);
    declared = false;
    await expect(
      planInstallation(root, selection, { replace: true })
    ).rejects.toThrow("declared execution, cleanup and usage capabilities");
    expect(await readFile(path.join(directory, "chatjs.json"), "utf-8")).toBe(
      installed
    );
  } finally {
    await server.stop(true);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function, eslint/max-statements */
/* oxlint-enable typescript/await-thenable, typescript/no-confusing-void-expression */
