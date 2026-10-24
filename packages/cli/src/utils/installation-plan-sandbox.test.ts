import { planSandboxInstallation } from "../helpers/sandbox-installation";
import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { builtInSandboxes } from "../../../registry/src/sandboxes/catalog";
import { codeExecutionItem } from "../../../registry/code-execution";
import { planInstallation } from "./installation-plan";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    })
  );
});

const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "sandbox-selection-"));
  roots.push(root);
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const name = new URL(request.url).pathname.slice(1).replace(".json", "");
      const dependentItem = {
        name: "dependent",
        type: "registry:item",
        meta: {
          chatjs: {
            contractVersion: 1,
            id: "dependent",
            kind: "tool",
            requiresTools: ["codeExecution"],
            tools: [{ toolExport: "dependent" }],
          },
        },
      };
      const items = [dependentItem, codeExecutionItem, ...builtInSandboxes];
      const item = items.find((candidate) => candidate.name === name);
      return item
        ? Response.json({ ...item, registryDependencies: [] })
        : new Response("not found", { status: 404 });
    },
  });
  const address = (name: string) => `http://127.0.0.1:${server.port}/${name}`;
  await writeFile(
    path.join(root, "components.json"),
    JSON.stringify({
      style: "new-york",
      rsc: true,
      tsx: true,
      tailwind: {
        config: "",
        css: "app/globals.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      aliases: { components: "@/components", utils: "@/lib/utils" },
      registries: { "@chatjs": address("{name}.json") },
    })
  );
  return { root, server, address };
};

test("sandboxes are optional; installing a consumer requires an explicit provider", async () => {
  const f = await fixture();
  try {
    const empty = await planInstallation(
      f.root,
      { plugins: [], tools: [] },
      { fresh: true }
    );
    expect(empty.providerChanges).toEqual([]);
    await rejects(
      planInstallation(
        f.root,
        { plugins: [], tools: [f.address("code-execution")] },
        { fresh: true }
      ),
      /--sandbox-provider/u
    );
    const selected = await planInstallation(
      f.root,
      {
        plugins: [],
        tools: [f.address("code-execution")],
        sandbox: f.address("daytona-sandbox"),
      },
      { fresh: true }
    );
    expect(selected.providerChanges).toEqual([
      { kind: "sandbox", next: "daytona", previous: undefined },
    ]);
    expect(selected.expected.map((tool) => tool.id)).toEqual([
      "code-execution",
    ]);
  } finally {
    await f.server.stop(true);
  }
});

test("provider-only installations expose no model tools and reject ambiguous selections", async () => {
  const f = await fixture();
  try {
    const selected = await planInstallation(
      f.root,
      { plugins: [], tools: [], sandbox: f.address("vercel-sandbox") },
      { fresh: true }
    );
    expect(selected.expected).toEqual([]);
    await rejects(
      planInstallation(
        f.root,
        {
          plugins: [],
          tools: [f.address("daytona-sandbox")],
          sandbox: f.address("vercel-sandbox"),
        },
        { fresh: true }
      ),
      /Only one sandbox provider/u
    );
  } finally {
    await f.server.stop(true);
  }
});

test("replacement requires --replace and the existing provider satisfies later consumers", async () => {
  const f = await fixture();
  try {
    await mkdir(path.join(f.root, "lib/sandbox"), { recursive: true });
    await writeFile(
      path.join(f.root, "lib/sandbox/options.ts"),
      'export const sandboxId = "vercel";'
    );
    const consumer = await planInstallation(f.root, {
      plugins: [],
      tools: [f.address("code-execution")],
    });
    expect(consumer.expected).toHaveLength(1);
    const selection = {
      plugins: [],
      tools: [],
      sandbox: f.address("daytona-sandbox"),
    };
    await rejects(planInstallation(f.root, selection), /--replace/u);
    const replaced = await planInstallation(f.root, selection, {
      replace: true,
    });
    expect(replaced.providerChanges).toEqual([
      { kind: "sandbox", next: "daytona", previous: "vercel" },
    ]);
  } finally {
    await f.server.stop(true);
  }
});

test("create requires a sandbox after resolving an indirect code-execution dependency", async () => {
  const f = await fixture();
  const requirements: boolean[] = [];
  try {
    const selected = await planSandboxInstallation(
      f.root,
      {
        plugins: [],
        tools: [f.address("dependent")],
      },
      { fresh: true },
      async (required) => {
        requirements.push(required);
        return await Promise.resolve(f.address("daytona-sandbox"));
      }
    );
    expect(requirements).toEqual([true]);
    expect(selected.plan.expected.map((tool) => tool.id)).toEqual([
      "dependent",
      "code-execution",
    ]);
    expect(selected.sandbox?.definition.id).toBe("daytona");
  } finally {
    await f.server.stop(true);
  }
});

test("create permits no sandbox when the resolved graph has no consumer", async () => {
  const f = await fixture();
  const requirements: boolean[] = [];
  try {
    const selected = await planSandboxInstallation(
      f.root,
      {
        plugins: [],
        tools: [],
      },
      { fresh: true },
      async (required) => {
        requirements.push(required);
        await Promise.resolve();
      }
    );
    expect(requirements).toEqual([false]);
    expect(selected.sandbox).toBeUndefined();
  } finally {
    await f.server.stop(true);
  }
});
