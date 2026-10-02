import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { planInstallation } from "./installation-plan";

const { join } = path;
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

test("plans transitive dependencies and repairs against the complete resulting installation without writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-plan-"));
  roots.push(root);
  const reader = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "read-document",
    kind: "tool",
    tools: [{ toolExport: "readDocument" }],
  });
  const documents = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "text-documents",
    kind: "tool",
    requiresTools: ["readDocument"],
    tools: [{ toolExport: "createTextDocument" }],
  });
  const server = Bun.serve({
    fetch(request): Response {
      const isReader = new URL(request.url).pathname.includes("read-document");
      const definition = isReader ? reader : documents;
      return Response.json({
        meta: { chatjs: definition },
        name: definition.id,
        registryDependencies: isReader
          ? []
          : [`http://127.0.0.1:${server.port}/read-document.json`],
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const source = `http://127.0.0.1:${server.port}`;
    const first = await planInstallation(root, {
      features: [],
      tools: [`${source}/text-documents.json`],
    });
    expect(first.expected.map((item) => item.id).toSorted()).toEqual([
      "read-document",
      "text-documents",
    ]);
    expect(await Bun.file(join(root, "tools/chatjs/tools.ts")).exists()).toBe(
      false
    );
    const dir = join(root, "tools/chatjs/text-documents");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "chatjs.json"), JSON.stringify(documents));
    await writeFile(
      join(dir, "tool.ts"),
      "export const createTextDocument = {};\n"
    );
    await expect(
      planInstallation(root, { features: [], tools: [] })
    ).rejects.toThrow("requires installed tools: readDocument");
    const repair = await planInstallation(root, {
      features: [],
      tools: [`${source}/read-document.json`],
    });
    expect(repair.expected).toEqual([reader]);
    expect(await readFile(join(dir, "tool.ts"), "utf-8")).toContain(
      "createTextDocument"
    );
  } finally {
    server.stop(true);
  }
});

const definition = (id: string) =>
  toolDefinitionSchema.parse({
    contractVersion: 1,
    id,
    kind: "tool",
    slot: "codeExecution",
    tools: [{ toolExport: "executeCode" }],
  });

test("rejects conflicting provider selections and permits reinstalling the selected provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-plan-provider-"));
  roots.push(root);
  const directory = join(root, "tools/chatjs/first");
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "chatjs.json"),
    JSON.stringify(definition("first"))
  );
  await writeFile(
    join(directory, "tool.ts"),
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
    expect(fresh.replacements.map(({ previous }) => previous.id)).toEqual([
      "first",
    ]);
    const reinstall = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/first.json`],
    });
    expect(reinstall.expected).toEqual([definition("first")]);
  } finally {
    server.stop(true);
  }
});

test("validates feature dependencies and exclusive storage slots before writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-plan-feature-"));
  roots.push(root);
  const server = Bun.serve({
    fetch(request): Response {
      const name = new URL(request.url).pathname.slice(1).replace(".json", "");
      const chatjs =
        name === "langfuse"
          ? {
              contractVersion: 1,
              id: "langfuse",
              kind: "feature",
              requiresFeatures: ["mcp"],
            }
          : {
              contractVersion: 1,
              id: name,
              kind: name === "mcp" ? "feature" : "storage",
            };
      return Response.json({
        meta: { chatjs },
        name,
        registryDependencies:
          name === "first"
            ? [`http://127.0.0.1:${server.port}/second.json`]
            : [],
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  const source = `http://127.0.0.1:${server.port}`;
  try {
    await expect(
      planInstallation(root, {
        features: [`${source}/langfuse.json`],
        tools: [],
      })
    ).rejects.toThrow("requires installed features: mcp");
    const plan = await planInstallation(root, {
      features: [`${source}/mcp.json`, `${source}/langfuse.json`],
      tools: [],
    });
    expect(plan.features.map((feature) => feature.id).toSorted()).toEqual([
      "langfuse",
      "mcp",
    ]);
    await expect(
      planInstallation(root, {
        features: [`${source}/mcp.json`],
        gateway: `${source}/mcp.json`,
        tools: [],
      })
    ).rejects.toThrow("Selected gateway item has incompatible ChatJS metadata");
    const dir = join(root, "features/mcp");
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, "chatjs.json"),
      JSON.stringify({ contractVersion: 1, id: "mcp", kind: "feature" })
    );
    await expect(
      planInstallation(root, {
        features: [`${source}/langfuse.json`],
        tools: [],
      })
    ).resolves.toMatchObject({ features: [{ id: "langfuse" }] });
    await expect(
      planInstallation(root, {
        features: [],
        storage: { options: {}, source: `${source}/first.json` },
        tools: [],
      })
    ).rejects.toThrow("Only one storage provider");
    expect(
      await Bun.file(join(root, "features/installed-routers.ts")).exists()
    ).toBe(false);
  } finally {
    server.stop(true);
  }
});
