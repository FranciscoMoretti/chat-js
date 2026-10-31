import { rejects } from "node:assert/strict";
import { parseJsonObject } from "#cli/helpers/json-object";
import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import { scaffoldFromTemplate } from "#cli/helpers/scaffold";

import { installItems } from "#cli/registry/shadcn";

import { installPlan } from "./install-plan";
import { recordInstalledSource } from "./source-receipt";

import { planInstallation } from "./installation-plan";

import { syncTools, toolRegistrationTargets } from "./sync-tools";
import * as installationFiles from "./installation-files";

const roots: string[] = [];
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
const server = (): Bun.Server<undefined> =>
  Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
      const id = new URL(request.url).pathname.slice(1).replace(".json", "");
      const definition = {
        contractVersion: 1,
        id,
        kind: "tool",
        ...(id === "extra"
          ? {}
          : {
              codeExecutionCapabilities: {
                cancellation: "terminate",
                cleanup: "durable-allocation",
                files: "ephemeral",
                languages: ["python", "javascript"],
                timeout: "bounded",
                usage: "single-receipt",
              },
              codeExecutorExport: "executeCode",
              slot: "codeExecution",
            }),
        tools: [{ toolExport: id === "extra" ? "extra" : "executeCode" }],
      };
      return Response.json({
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: `~/chatjs/tools/${id}/chatjs.json`,
            type: "registry:file",
          },
          {
            content: `export const ${id === "extra" ? "extra" : "executeCode"} = {};\n`,
            path: "tool.ts",
            target: `~/chatjs/tools/${id}/tool.ts`,
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
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-replacement-"));
  roots.push(root);
  await scaffoldFromTemplate(root);
  return root;
};

test("receipt hashing bounds live buffers, drains failures and never writes a partial receipt", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-hash-batch-"));
  roots.push(root);
  const targets = Array.from({ length: 5 }, (_, index) => `${index}.ts`);
  const gates = targets.map(() => Promise.withResolvers<Buffer>());
  const admitted = Promise.withResolvers<boolean>();
  const originalRead = installationFiles.optionalFile;
  let reads = 0;
  const read = spyOn(installationFiles, "optionalFile").mockImplementation(
    async (file) => {
      const index = targets.indexOf(path.basename(file));
      if (index === -1) {
        return await originalRead(file);
      }
      reads += 1;
      if (reads === 4) {
        admitted.resolve(true);
      }
      return await gates[index].promise;
    }
  );
  const recording = recordInstalledSource(root, targets);
  const rejected = rejects(recording, /first source/u);
  let settled = false;
  void recording.catch(() => {
    settled = true;
  });
  try {
    await admitted.promise;
    gates[1].reject(new Error("second source"));
    gates[0].reject(new Error("first source"));
    await Promise.resolve();
    expect(reads).toBe(4);
    expect(settled).toBe(false);
    gates[2].resolve(Buffer.from("third"));
    gates[3].resolve(Buffer.from("fourth"));
    await rejected;
    expect(reads).toBe(4);
    expect(
      await Bun.file(path.join(root, "chatjs/installed-source.json")).exists()
    ).toBe(false);
  } finally {
    read.mockRestore();
  }
});

test("explicit provider replacement preserves unrelated installations and refuses modified old source before any write", async (): Promise<void> => {
  const root = await fixture();
  const registry = server();
  const source = (id: string): string =>
    `http://127.0.0.1:${registry.port}/${id}.json`;
  try {
    const first = await planInstallation(root, {
      plugins: [],
      tools: [source("first"), source("extra")],
    });
    await installPlan(root, first, {}, async (): Promise<void> => {
      await syncTools(root, { expected: first.expected });
    });
    await rejects(
      planInstallation(root, { plugins: [], tools: [source("second")] }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("--replace");
        return true;
      }
    );
    const plan = await planInstallation(
      root,
      { plugins: [], tools: [source("second")] },
      { replace: true }
    );
    const old = path.join(root, "chatjs/tools/first/tool.ts");
    await writeFile(
      old,
      "// my implementation\nexport const executeCode = {};\n"
    );
    await rejects(
      installPlan(root, plan, {}, async (): Promise<void> => {
        await syncTools(root);
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("--overwrite");
        return true;
      }
    );
    expect(
      await Bun.file(
        path.join(root, "chatjs/tools/second/chatjs.json")
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
    expect(
      tools.map((tool: { readonly id: string }): string => tool.id)
    ).toEqual(["extra", "second"]);
    expect(await Bun.file(old).exists()).toBe(false);
    expect(
      await readFile(path.join(root, "chatjs/tools/extra/tool.ts"), "utf-8")
    ).toContain("extra");
  } finally {
    await registry.stop(true);
  }
}, 30_000);

test.each(["registration", "finalization"] as const)(
  "failed %s restores previous provider source, manifest, receipts and lockfiles",
  async (phase): Promise<void> => {
    const root = await fixture();
    const registry = server();
    const source = (id: string): string =>
      `http://127.0.0.1:${registry.port}/${id}.json`;
    try {
      const first = await planInstallation(root, {
        plugins: [],
        tools: [source("first")],
      });
      await installPlan(root, first, {}, async (): Promise<void> => {
        await syncTools(root);
      });
      const plan = await planInstallation(
        root,
        { plugins: [], tools: [source("second")] },
        { replace: true }
      );
      const env = path.join(root, ".env.example");
      const config = path.join(root, "chat.config.ts");
      const manifest = path.join(root, "package.json");
      const dependencies = path.join(
        root,
        "chatjs/installed-dependencies.json"
      );
      const lockfile = path.join(root, "bun.lock");
      await writeFile(lockfile, "original lockfile");
      const oldManifest = await readFile(manifest, "utf-8");
      const oldDependencies = await readFile(dependencies, "utf-8");
      const oldEnv = await readFile(env, "utf-8");
      const oldConfig = await readFile(config, "utf-8");
      await rm(path.join(root, "chatjs/generated/workflow-types.ts"));
      const registrationContents = async (
        target: string
      ): Promise<string | null> => {
        const file = Bun.file(path.join(root, target));
        if (await file.exists()) {
          return await file.text();
        }
        return null;
      };
      const oldRegistrations = await Promise.all(
        toolRegistrationTargets.map(
          async (target) => await registrationContents(target)
        )
      );

      await rejects(
        installPlan(
          root,
          plan,
          {
            finalize: async (): Promise<void> => {
              await writeFile(manifest, "{}");
              await writeFile(lockfile, "partial dependency install");
              throw new Error("fixture finalization failed");
            },
            rollbackTargets: [".env.example", "chat.config.ts"],
          },
          async () => {
            await writeFile(env, "MODIFIED=1\n");
            await writeFile(config, "// partial config\n");
            await syncTools(root, { expected: plan.expected });
            expect(
              await readFile(
                path.join(root, "chatjs/generated/providers.ts"),
                "utf-8"
              )
            ).toContain("@/chatjs/tools/second/tool");
            if (phase === "registration") {
              throw new Error("fixture registration failed");
            }
          }
        ),
        (reason: unknown) => {
          expect(() => {
            throw reason;
          }).toThrow(`fixture ${phase} failed`);
          return true;
        }
      );
      expect(await readFile(manifest, "utf-8")).toBe(oldManifest);
      expect(await readFile(dependencies, "utf-8")).toBe(oldDependencies);
      expect(await readFile(lockfile, "utf-8")).toBe("original lockfile");
      expect(
        await Bun.file(
          path.join(root, "chatjs/tools/second/chatjs.json")
        ).exists()
      ).toBe(false);
      expect(await readFile(env, "utf-8")).toBe(oldEnv);
      expect(await readFile(config, "utf-8")).toBe(oldConfig);
      expect(
        await Promise.all(
          toolRegistrationTargets.map(
            async (target) => await registrationContents(target)
          )
        )
      ).toEqual(oldRegistrations);
      expect(
        await Bun.file(
          path.join(root, "chatjs/tools/first/chatjs.json")
        ).exists()
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
      expect(
        tools.map((tool: { readonly id: string }): string => tool.id)
      ).toEqual(["second"]);
    } finally {
      await registry.stop(true);
    }
  },
  30_000
);

test("native shadcn source can be composed without overwriting or blessing user edits", async (): Promise<void> => {
  const root = await fixture();
  const registry = server();
  const address = `http://127.0.0.1:${registry.port}/first.json`;
  try {
    await installItems([address], root);
    const file = path.join(root, "chatjs/tools/first/tool.ts");
    await writeFile(
      file,
      "// native user edit\nexport const executeCode = {};\n"
    );
    const plan = await planInstallation(root, {
      plugins: [],
      tools: [address],
    });
    await installPlan(root, plan, {}, async (): Promise<void> => {
      await syncTools(root);
    });
    expect(await readFile(file, "utf-8")).toContain("native user edit");
    const receipt = parseJsonObject(
      await readFile(path.join(root, "chatjs/installed-source.json"), "utf-8"),
      "installed source receipt"
    );
    expect(receipt["chatjs/tools/first/tool.ts"]).toBeUndefined();
    const tools = await syncTools(root, { checkOnly: true });
    expect(
      tools.map((tool: { readonly id: string }): string => tool.id)
    ).toEqual(["first"]);
  } finally {
    await registry.stop(true);
  }
}, 30_000);

test("registration refreshes untouched rollback baselines without blessing user edits", async (): Promise<void> => {
  const root = await fixture();
  const file = path.join(root, ".env.example");
  await recordInstalledSource(root, [
    ".env.example",
    "chatjs/providers/storage.ts",
  ]);
  const registry = Bun.serve({
    fetch: () =>
      Response.json({
        files: [
          {
            content: "export const createStorageAdapter = () => ({});\n",
            path: "storage-provider.ts",
            target: "~/chatjs/providers/storage.ts",
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
    const plan = await planInstallation(root, { plugins: [], tools: [] });
    const storagePlan = await planInstallation(
      root,
      {
        plugins: [],
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
    const receiptFile = path.join(root, "chatjs/installed-source.json");
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
    await rejects(
      installPlan(
        root,
        storagePlan,
        { managedTargets: [".env.example"] },
        async (): Promise<void> => {
          registered = true;
          await writeFile(file, "must not reach registration");
        }
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("No source was installed");
        return true;
      }
    );
    expect(registered).toBe(false);
    expect(await readFile(file, "utf-8")).toContain("user storage notes");
  } finally {
    await registry.stop(true);
  }
}, 30_000);

test("provider installation refuses inferred native dependency destinations before any overwrite", async (): Promise<void> => {
  const root = await fixture();
  const ui = path.join(root, "components/ui/fixture.tsx");
  await mkdir(path.dirname(ui), { recursive: true });
  await writeFile(ui, "// user UI customization\n");
  const registry = Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
      const inferred = new URL(request.url).pathname.endsWith("ui.json");
      if (inferred) {
        return Response.json({
          files: [
            {
              content: "// replacement UI\n",
              path: "fixture.tsx",
              type: "registry:ui",
            },
          ],
          name: "fixture-ui",
          type: "registry:ui",
        });
      }
      return Response.json({
        files: [
          {
            content: "export const createStorageAdapter = () => ({});\n",
            path: "storage-provider.ts",
            target: "~/chatjs/providers/storage.ts",
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
        registryDependencies: [`http://127.0.0.1:${registry.port}/ui.json`],
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const provider = path.join(root, "chatjs/providers/storage.ts");
    await writeFile(provider, "// original provider\n");
    await recordInstalledSource(root, ["chatjs/providers/storage.ts"]);
    const originalProvider = await readFile(provider, "utf-8");
    const plan = await planInstallation(
      root,
      {
        plugins: [],
        storage: {
          options: {},
          source: `http://127.0.0.1:${registry.port}/storage.json`,
        },
        tools: [],
      },
      { replace: true }
    );
    const register = mock<() => Promise<void>>().mockRejectedValue(
      new Error("registration must not run")
    );
    await rejects(installPlan(root, plan, {}, register), (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("Cannot safely overwrite inferred installer destinations");
      return true;
    });
    expect(register).not.toHaveBeenCalled();
    expect(await readFile(ui, "utf-8")).toBe("// user UI customization\n");
    expect(await readFile(provider, "utf-8")).toBe(originalProvider);
    const native = await planInstallation(root, {
      plugins: [],
      tools: [`http://127.0.0.1:${registry.port}/ui.json`],
    });
    const receipt = await readFile(
      path.join(root, "chatjs/installed-source.json"),
      "utf-8"
    );
    expect(receipt).not.toContain("components/ui/fixture.tsx");
    await rejects(
      installPlan(
        root,
        native,
        { overwrite: true },
        mock<() => Promise<void>>().mockRejectedValue(
          new Error("registration must not run")
        )
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("No source was installed");
        return true;
      }
    );
  } finally {
    await registry.stop(true);
  }
}, 30_000);

test("failed fresh registration restores the scaffold sandbox selection", async () => {
  const root = await fixture();
  const target = path.join(root, "chatjs/providers/sandbox/options.ts");
  const original = await readFile(target, "utf-8");
  const plan = await planInstallation(
    root,
    { plugins: [], tools: [] },
    { fresh: true }
  );
  await rejects(
    installPlan(
      root,
      plan,
      {
        fresh: true,
        managedTargets: ["chatjs/providers/sandbox/options.ts"],
      },
      async () => {
        await writeFile(target, 'export const sandboxId = "daytona";');
        throw new Error("registration failed");
      }
    ),
    /registration failed/u
  );
  expect(await readFile(target, "utf-8")).toBe(original);
});
