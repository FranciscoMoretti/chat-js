import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { scaffoldFromTemplate } from "../helpers/scaffold";
import { installItems } from "../registry/shadcn";
import { installPlan, recordInstalledSource } from "./install-plan";
import { planInstallation } from "./installation-plan";
import { syncTools, toolRegistrationTargets } from "./sync-tools";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
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
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-replacement-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  return root;
};

test("explicit provider replacement preserves unrelated installations and refuses modified old source before any write", async () => {
  const root = await fixture();
  const registry = server();
  const source = (id: string) => `http://127.0.0.1:${registry.port}/${id}.json`;
  try {
    const first = await planInstallation(root, {
      features: [],
      tools: [source("first"), source("extra")],
    });
    await installPlan(root, first, {}, async () => {
      await syncTools(root, { expected: first.expected });
    });
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
    await expect(
      installPlan(root, plan, {}, async () => {
        await syncTools(root);
      })
    ).rejects.toThrow("--overwrite");
    expect(
      await Bun.file(
        path.join(root, "tools/chatjs/second/chatjs.json")
      ).exists()
    ).toBe(false);
    expect(await readFile(old, "utf-8")).toContain("my implementation");
    await installPlan(root, plan, { overwrite: true }, async () => {
      await syncTools(root, { expected: plan.expected });
    });
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool) => tool.id)).toEqual(["extra", "second"]);
    expect(await Bun.file(old).exists()).toBe(false);
    expect(
      await readFile(path.join(root, "tools/chatjs/extra/tool.ts"), "utf-8")
    ).toContain("extra");
  } finally {
    registry.stop(true);
  }
}, 30_000);

test("unmodified replacement works without overwrite and failed registration restores previous source", async () => {
  const root = await fixture();
  const registry = server();
  const source = (id: string) => `http://127.0.0.1:${registry.port}/${id}.json`;
  try {
    const first = await planInstallation(root, {
      features: [],
      tools: [source("first")],
    });
    await installPlan(root, first, {}, async () => {
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
    await installPlan(root, plan, { overwrite: true }, async () => {
      await syncTools(root);
    });
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool) => tool.id)).toEqual(["second"]);
  } finally {
    registry.stop(true);
  }
}, 30_000);

test("native shadcn source can be composed without overwriting or blessing user edits", async () => {
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
    await installPlan(root, plan, {}, async () => {
      await syncTools(root);
    });
    expect(await readFile(file, "utf-8")).toContain("native user edit");
    const receipt = JSON.parse(
      await readFile(path.join(root, ".chatjs/installed-source.json"), "utf-8")
    );
    expect(receipt["tools/chatjs/first/tool.ts"]).toBeUndefined();
    const tools = await syncTools(root, { checkOnly: true });
    expect(tools.map((tool) => tool.id)).toEqual(["first"]);
  } finally {
    registry.stop(true);
  }
}, 30_000);

test("registration refreshes untouched rollback baselines without blessing user edits", async () => {
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
      async () => {
        await writeFile(file, "GATEWAY=changed\n");
      }
    );
    await installPlan(
      root,
      storagePlan,
      { managedTargets: [".env.example"] },
      async () => {
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
      async () => {
        await writeFile(
          file,
          "# user storage notes\nSTORAGE=changed\nGATEWAY=next\n"
        );
      }
    );
    expect(await readFile(receiptFile, "utf-8")).toBe(baseline);
    let registered = false;
    await expect(
      installPlan(
        root,
        storagePlan,
        { managedTargets: [".env.example"] },
        async () => {
          registered = true;
          await writeFile(file, "must not reach registration");
        }
      )
    ).rejects.toThrow("No source was installed");
    expect(registered).toBe(false);
    expect(await readFile(file, "utf-8")).toContain("user storage notes");
  } finally {
    registry.stop(true);
  }
}, 30_000);

test("provider installation refuses inferred native dependency destinations before any overwrite", async () => {
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
    await expect(
      installPlan(root, plan, {}, () => {
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
    await expect(
      installPlan(root, native, { overwrite: true }, () => Promise.resolve())
    ).rejects.toThrow("No source was installed");
  } finally {
    registry.stop(true);
  }
}, 30_000);
