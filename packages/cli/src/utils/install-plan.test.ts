import { afterEach, expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { scaffoldFromTemplate } from "../helpers/scaffold";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { installItems } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
import { installPlan, recordInstalledSource } from "./install-plan";
import { planInstallation } from "./installation-plan";
import { syncTools, toolRegistrationTargets } from "./sync-tools";

const roots: string[] = [];
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots
      .splice(0)
      .map((root): Promise<void> => rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const server = () =>
  Bun.serve({
    fetch(request) {
      const id = new URL(request.url).pathname.slice(1).replace(".json", "");
      const definition = {
        contractVersion: 1,
        id,
        kind: "tool",
        ...(id === "extra" ? {} : { slot: "codeExecution" }),
        tools: [{ toolExport: id === "extra" ? "extra" : "executeCode" }],
      };
      return Response.json({
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: `~/tools/chatjs/${id}/chatjs.json`,
            type: "registry:file",
          },
          {
            content: `export const ${id === "extra" ? "extra" : "executeCode"} = {};\n`,
            path: "tool.ts",
            target: `~/tools/chatjs/${id}/tool.ts`,
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: id,
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-replacement-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  return root;
};
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("explicit provider replacement preserves unrelated installations and refuses modified old source before any write", async (): Promise<void> => {
  const root = await fixture();
  const registry = server();
  const source = (id: string): string =>
    `http://127.0.0.1:${registry.port}/${id}.json`;
  try {
    const first = await planInstallation(root, {
      features: [],
      tools: [source("first"), source("extra")],
    });
    await installPlan(root, first, {}, async (): Promise<void> => {
      await syncTools(root, { expected: first.expected });
    });
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      planInstallation(root, { features: [], tools: [source("second")] })
    ).rejects.toThrow("--replace");
    const plan = await planInstallation(
      root,
      { features: [], tools: [source("second")] },
      { replace: true }
    );
    const old = path.join(root, "tools/chatjs/first/tool.ts");
    await writeFile(
      old,
      "// my implementation\nexport const executeCode = {};\n"
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installPlan(root, plan, {}, async (): Promise<void> => {
        await syncTools(root);
      })
    ).rejects.toThrow("--overwrite");
    expect(
      await Bun.file(
        path.join(root, "tools/chatjs/second/chatjs.json")
      ).exists()
    ).toBe(false);
    expect(await readFile(old, "utf-8")).toContain("my implementation");
    await installPlan(
      root,
      plan,
      { overwrite: true },
      async (): Promise<void> => {
        await syncTools(root, { expected: plan.expected });
      }
    );
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool): string => tool.id)).toEqual(["extra", "second"]);
    expect(await Bun.file(old).exists()).toBe(false);
    expect(
      await readFile(path.join(root, "tools/chatjs/extra/tool.ts"), "utf-8")
    ).toContain("extra");
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    registry.stop(true);
  }
}, 30_000);
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("unmodified replacement works without overwrite and failed registration restores previous source", async (): Promise<void> => {
  const root = await fixture();
  const registry = server();
  const source = (id: string): string =>
    `http://127.0.0.1:${registry.port}/${id}.json`;
  try {
    const first = await planInstallation(root, {
      features: [],
      tools: [source("first")],
    });
    await installPlan(root, first, {}, async (): Promise<void> => {
      await syncTools(root);
    });
    const plan = await planInstallation(
      root,
      { features: [], tools: [source("second")] },
      { replace: true }
    );
    const env = path.join(root, ".env.example");
    const config = path.join(root, "chat.config.ts");
    const oldEnv = await readFile(env, "utf-8");
    const oldConfig = await readFile(config, "utf-8");
    await rm(path.join(root, "tools/chatjs/workflow-types.ts"));
    const registrationContents = (target: string) => {
      const file = Bun.file(path.join(root, target));
      return file.exists().then((exists) => (exists ? file.text() : null));
    };
    const oldRegistrations = await Promise.all(
      toolRegistrationTargets.map((target) => registrationContents(target))
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installPlan(
        root,
        plan,
        { rollbackTargets: [".env.example", "chat.config.ts"] },
        async () => {
          await writeFile(env, "MODIFIED=1\n");
          await writeFile(config, "// partial config\n");
          await syncTools(root, { expected: plan.expected });
          expect(
            await readFile(
              path.join(root, "tools/chatjs/providers.ts"),
              "utf-8"
            )
          ).toContain("./second/tool");
          throw new Error("fixture registration failed");
        }
      )
    ).rejects.toThrow("fixture registration failed");
    expect(await readFile(env, "utf-8")).toBe(oldEnv);
    expect(await readFile(config, "utf-8")).toBe(oldConfig);
    expect(
      await Promise.all(
        toolRegistrationTargets.map((target) => registrationContents(target))
      )
    ).toEqual(oldRegistrations);
    expect(
      await Bun.file(path.join(root, "tools/chatjs/first/chatjs.json")).exists()
    ).toBe(true);
    await installPlan(
      root,
      plan,
      { overwrite: true },
      async (): Promise<void> => {
        await syncTools(root);
      }
    );
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool): string => tool.id)).toEqual(["second"]);
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    registry.stop(true);
  }
}, 30_000);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("native shadcn source can be composed without overwriting or blessing user edits", async (): Promise<void> => {
  const root = await fixture();
  const registry = server();
  const address = `http://127.0.0.1:${registry.port}/first.json`;
  try {
    await installItems([address], root);
    const file = path.join(root, "tools/chatjs/first/tool.ts");
    await writeFile(
      file,
      "// native user edit\nexport const executeCode = {};\n"
    );
    const plan = await planInstallation(root, {
      features: [],
      tools: [address],
    });
    await installPlan(root, plan, {}, async (): Promise<void> => {
      await syncTools(root);
    });
    expect(await readFile(file, "utf-8")).toContain("native user edit");
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const receipt = JSON.parse(
      await readFile(path.join(root, ".chatjs/installed-source.json"), "utf-8")
    );
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(receipt["tools/chatjs/first/tool.ts"]).toBeUndefined();
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool): string => tool.id)).toEqual(["first"]);
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    registry.stop(true);
  }
}, 30_000);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("registration refreshes untouched rollback baselines without blessing user edits", async (): Promise<void> => {
  const root = await fixture();
  const file = path.join(root, ".env.example");
  await recordInstalledSource(root, [
    ".env.example",
    "lib/storage-provider.ts",
  ]);
  const registry = Bun.serve({
    fetch: () =>
      Response.json({
        files: [
          {
            content: "export const createStorageAdapter = () => ({});\n",
            path: "storage-provider.ts",
            target: "~/lib/storage-provider.ts",
            type: "registry:file",
          },
        ],
        meta: {
          chatjs: {
            contractVersion: 1,
            id: "fixture-storage",
            kind: "storage",
          },
        },
        name: "fixture-storage",
        type: "registry:item",
      }),
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const plan = await planInstallation(root, { features: [], tools: [] });
    const storagePlan = await planInstallation(
      root,
      {
        features: [],
        storage: {
          options: {},
          source: `http://127.0.0.1:${registry.port}/storage.json`,
        },
        tools: [],
      },
      { replace: true }
    );
    await installPlan(
      root,
      plan,
      { rollbackTargets: [".env.example"] },
      async (): Promise<void> => {
        await writeFile(file, "GATEWAY=changed\n");
      }
    );
    await installPlan(
      root,
      storagePlan,
      { managedTargets: [".env.example"] },
      async (): Promise<void> => {
        await writeFile(file, "STORAGE=changed\n");
      }
    );
    const receiptFile = path.join(root, ".chatjs/installed-source.json");
    const baseline = await readFile(receiptFile, "utf-8");
    await writeFile(file, "# user storage notes\nSTORAGE=changed\n");
    await installPlan(
      root,
      plan,
      { rollbackTargets: [".env.example"] },
      async (): Promise<void> => {
        await writeFile(
          file,
          "# user storage notes\nSTORAGE=changed\nGATEWAY=next\n"
        );
      }
    );
    expect(await readFile(receiptFile, "utf-8")).toBe(baseline);
    let registered = false;
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installPlan(
        root,
        storagePlan,
        { managedTargets: [".env.example"] },
        async (): Promise<void> => {
          registered = true;
          await writeFile(file, "must not reach registration");
        }
      )
    ).rejects.toThrow("No source was installed");
    expect(registered).toBe(false);
    expect(await readFile(file, "utf-8")).toContain("user storage notes");
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    registry.stop(true);
  }
}, 30_000);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
test("provider installation refuses inferred native dependency destinations before any overwrite", async (): Promise<void> => {
  const root = await fixture();
  const ui = path.join(root, "components/ui/fixture.tsx");
  await mkdir(path.dirname(ui), { recursive: true });
  await writeFile(ui, "// user UI customization\n");
  const registry = Bun.serve({
    fetch(request): Response {
      const inferred = new URL(request.url).pathname.endsWith("ui.json");
      return Response.json(
        inferred
          ? {
              files: [
                {
                  content: "// replacement UI\n",
                  path: "fixture.tsx",
                  type: "registry:ui",
                },
              ],
              name: "fixture-ui",
              type: "registry:ui",
            }
          : {
              files: [
                {
                  content: "export const createStorageAdapter = () => ({});\n",
                  path: "storage-provider.ts",
                  target: "~/lib/storage-provider.ts",
                  type: "registry:file",
                },
              ],
              meta: {
                chatjs: {
                  contractVersion: 1,
                  id: "fixture-storage",
                  kind: "storage",
                },
              },
              name: "fixture-storage",
              registryDependencies: [
                `http://127.0.0.1:${registry.port}/ui.json`,
              ],
              type: "registry:item",
            }
      );
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const provider = path.join(root, "lib/storage-provider.ts");
    await writeFile(provider, "// original provider\n");
    await recordInstalledSource(root, ["lib/storage-provider.ts"]);
    const originalProvider = await readFile(provider, "utf-8");
    const plan = await planInstallation(
      root,
      {
        features: [],
        storage: {
          options: {},
          source: `http://127.0.0.1:${registry.port}/storage.json`,
        },
        tools: [],
      },
      { replace: true }
    );
    let registered = false;
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installPlan(root, plan, {}, (): Promise<void> => {
        registered = true;
        return Promise.reject(new Error("registration must not run"));
      })
    ).rejects.toThrow(
      "Cannot safely overwrite inferred installer destinations"
    );
    expect(registered).toBe(false);
    expect(await readFile(ui, "utf-8")).toBe("// user UI customization\n");
    expect(await readFile(provider, "utf-8")).toBe(originalProvider);
    const native = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${registry.port}/ui.json`],
    });
    const receipt = await readFile(
      path.join(root, ".chatjs/installed-source.json"),
      "utf-8"
    );
    expect(receipt).not.toContain("components/ui/fixture.tsx");
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      installPlan(root, native, { overwrite: true }, (): Promise<void> =>
        Promise.resolve()
      )
    ).rejects.toThrow("No source was installed");
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    registry.stop(true);
  }
}, 30_000);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
