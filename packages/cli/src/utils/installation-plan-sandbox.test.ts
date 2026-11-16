import { planInstallation } from "./installation-plan";
import { planSandboxInstallation } from "../helpers/sandbox-installation";
import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { builtInSandboxes } from "../../../registry/src/sandboxes/catalog";

const nativeRuntimeItem = {
  name: "native-runtime",
  type: "registry:item",
  meta: {
    chatjs: {
      contractVersion: 1,
      kind: "tool",
      id: "native-runtime",
      requiresNativeProcesses: true,
      tools: [{ toolExport: "nativeRun" }],
    },
  },
};

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
    async fetch(request) {
      const name = new URL(request.url).pathname.slice(1).replace(".json", "");
      const dependentItem = {
        name: "dependent",
        registryDependencies: ["@chatjs/native-runtime"],
        type: "registry:item",
        meta: {
          chatjs: {
            contractVersion: 1,
            id: "dependent",
            kind: "tool",
            requiresTools: ["nativeRun"],
            tools: [{ toolExport: "dependent" }],
          },
        },
      };
      const items = [
        dependentItem,
        nativeRuntimeItem,
        ...builtInSandboxes,
        {
          name: "attachment-uploads",
          type: "registry:item",
          meta: {
            chatjs: {
              kind: "plugin",
              contractVersion: 1,
              id: "attachment-uploads",
              requiresStorage: true,
            },
          },
        },
        {
          name: "storage",
          type: "registry:item",
          meta: {
            chatjs: {
              kind: "storage",
              contractVersion: 1,
              id: "s3",
              configKeys: [],
            },
          },
        },
      ];
      const item = items.find((candidate) => candidate.name === name);
      const sandbox = builtInSandboxes.find(
        (candidate) => candidate.name === name
      );
      const files = sandbox
        ? await Promise.all(
            sandbox.files.map(async (file) => ({
              ...file,
              content: await readFile(
                new URL(`../../../registry/${file.path}`, import.meta.url),
                "utf-8"
              ),
            }))
          )
        : [];
      return item
        ? Response.json({
            ...item,
            files,
            registryDependencies:
              name === "dependent" ? ["@chatjs/native-runtime"] : [],
          })
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

test("native default needs no explicit selection; code execution rejects just-bash", async () => {
  const f = await fixture();
  try {
    const empty = await planInstallation(
      f.root,
      { plugins: [], tools: [] },
      { fresh: true }
    );
    expect(empty.providerChanges).toEqual([]);
    const automatic = await planInstallation(
      f.root,
      { plugins: [], tools: [f.address("native-runtime")] },
      { fresh: true }
    );
    expect(automatic.expected).toHaveLength(1);
    await rejects(
      planInstallation(
        f.root,
        {
          plugins: [],
          tools: [f.address("native-runtime")],
          sandbox: f.address("just-bash-sandbox"),
        },
        { fresh: true }
      ),
      /native Python/u
    );
    const selected = await planInstallation(
      f.root,
      {
        plugins: [],
        tools: [f.address("native-runtime")],
        sandbox: f.address("docker-sandbox"),
      },
      { fresh: true }
    );
    expect(selected.providerChanges).toEqual([
      { kind: "sandbox", next: "docker", previous: undefined },
    ]);
    expect(selected.expected.map((tool) => tool.id)).toEqual([
      "native-runtime",
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
          tools: [f.address("docker-sandbox")],
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
    await mkdir(path.join(f.root, "agent"), {
      recursive: true,
    });
    await writeFile(
      path.join(f.root, "agent/sandbox.ts"),
      'import { VercelSandbox } from "eve/sandbox/vercel";'
    );
    const consumer = await planInstallation(f.root, {
      plugins: [],
      tools: [f.address("native-runtime")],
    });
    expect(consumer.expected).toHaveLength(1);
    const selection = {
      plugins: [],
      tools: [],
      sandbox: f.address("docker-sandbox"),
    };
    await rejects(planInstallation(f.root, selection), /--replace/u);
    const replaced = await planInstallation(f.root, selection, {
      replace: true,
    });
    expect(replaced.providerChanges).toEqual([
      { kind: "sandbox", next: "docker", previous: "vercel" },
    ]);
  } finally {
    await f.server.stop(true);
  }
});

test("create installs the chosen native environment with indirect code-execution dependencies", async () => {
  const f = await fixture();
  try {
    const selected = await planSandboxInstallation(
      f.root,
      {
        plugins: [],
        tools: [f.address("dependent")],
      },
      { fresh: true },
      async () => await Promise.resolve(f.address("docker-sandbox"))
    );
    expect(selected.plan.expected.map((tool) => tool.id)).toEqual([
      "dependent",
      "native-runtime",
    ]);
    expect(selected.sandbox?.definition.id).toBe("docker");
  } finally {
    await f.server.stop(true);
  }
});

test("create defaults to a native EVE environment without tools", async () => {
  const f = await fixture();
  try {
    const selected = await planSandboxInstallation(
      f.root,
      {
        plugins: [],
        tools: [],
      },
      { fresh: true },
      async () => await Promise.resolve("default")
    );
    expect(selected.sandbox.definition.id).toBe("default");
  } finally {
    await f.server.stop(true);
  }
});

test("uploads can use the native sandbox without a ChatJS provider", async () => {
  const f = await fixture();
  try {
    const selection = {
      plugins: [f.address("attachment-uploads")],
      tools: [],
      storage: { source: f.address("storage"), options: {} },
    };
    const selected = await planSandboxInstallation(
      f.root,
      selection,
      { fresh: true },
      async () => await Promise.resolve("default")
    );
    expect(selected.sandbox.definition.id).toBe("default");
    await planInstallation(
      f.root,
      { ...selection, sandbox: f.address("docker-sandbox") },
      { fresh: true }
    );
  } finally {
    await f.server.stop(true);
  }
});
