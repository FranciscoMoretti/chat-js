import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import { toolDefinitionSchema } from "../../../registry/metadata";

import { planInstallation } from "./installation-plan";

const roots: string[] = [];
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { force: true, recursive: true });
    })
  );
});

test("requested plugins can repair incomplete installations while unrelated installs still reject them", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plugin-repair-"));
  roots.push(root);
  const directory = path.join(root, "chatjs/plugins/team-notes");
  await mkdir(directory, { recursive: true });
  const definition = {
    contractVersion: 1,
    id: "team-notes",
    kind: "plugin",
    files: ["chatjs/plugins/team-notes/server-plugin.ts"],
  };
  await writeFile(
    path.join(directory, "chatjs.json"),
    JSON.stringify(definition)
  );
  const server = Bun.serve({
    fetch(): Response {
      return Response.json({
        meta: { chatjs: definition },
        name: "team-notes",
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    await rejects(
      planInstallation(root, { plugins: [], tools: [] }),
      /installation is incomplete/u
    );
    const plan = await planInstallation(root, {
      plugins: [`http://127.0.0.1:${server.port}/team-notes.json`],
      tools: [],
    });
    expect(plan.plugins.map((plugin) => plugin.id)).toEqual(["team-notes"]);
    expect(
      await Bun.file(path.join(directory, "server-plugin.ts")).exists()
    ).toBe(false);
  } finally {
    await server.stop(true);
  }
});

test("plans transitive dependencies and repairs against the complete resulting installation without writing", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plan-"));
  roots.push(root);
  const reader = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "fetch-data",
    kind: "tool",
    tools: [{ toolExport: "fetchData" }],
  });
  const documents = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "report-tools",
    kind: "tool",
    requiresTools: ["fetchData"],
    tools: [{ toolExport: "createReport" }],
  });
  const server = Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
      const isReader = new URL(request.url).pathname.includes("fetch-data");
      const definition = isReader ? reader : documents;
      return Response.json({
        meta: { chatjs: definition },
        name: definition.id,
        registryDependencies: isReader
          ? []
          : [`http://127.0.0.1:${server.port}/fetch-data.json`],
        type: "registry:item",
      });
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  try {
    const source = `http://127.0.0.1:${server.port}`;

    const first = await planInstallation(root, {
      plugins: [],
      tools: [`${source}/report-tools.json`],
    });
    expect(
      first.expected
        .map((item: { readonly id: string }): string => item.id)
        .toSorted()
    ).toEqual(["fetch-data", "report-tools"]);
    expect(
      await Bun.file(path.join(root, "chatjs/generated/tools.ts")).exists()
    ).toBe(false);
    const dir = path.join(root, "chatjs/tools/report-tools");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "chatjs.json"), JSON.stringify(documents));
    await writeFile(
      path.join(dir, "tool.ts"),
      "export const createReport = {};\n"
    );
    await rejects(
      planInstallation(root, { plugins: [], tools: [] }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("requires installed tools: fetchData");
        return true;
      }
    );
    const repair = await planInstallation(root, {
      plugins: [],
      tools: [`${source}/fetch-data.json`],
    });
    expect(repair.expected).toEqual([reader]);
    expect(await readFile(path.join(dir, "tool.ts"), "utf-8")).toContain(
      "createReport"
    );
  } finally {
    await server.stop(true);
  }
});

test("validates plugin dependencies and exclusive storage slots before writing", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plan-plugin-"));
  roots.push(root);
  const server = Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
      const name = new URL(request.url).pathname.slice(1).replace(".json", "");
      const chatjs =
        name === "custom-service"
          ? {
              contractVersion: 1,
              id: "custom-service",
              kind: "plugin",
              requiresPlugins: ["mcp"],
            }
          : {
              contractVersion: 1,
              id: name,
              kind: name === "mcp" ? "plugin" : "storage",
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
    await rejects(
      planInstallation(root, {
        plugins: [`${source}/custom-service.json`],
        tools: [],
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("requires installed plugins: mcp");
        return true;
      }
    );
    const plan = await planInstallation(root, {
      plugins: [`${source}/mcp.json`, `${source}/custom-service.json`],
      tools: [],
    });
    expect(
      plan.plugins
        .map((plugin: { readonly id: string }): string => plugin.id)
        .toSorted()
    ).toEqual(["custom-service", "mcp"]);
    await rejects(
      planInstallation(root, {
        plugins: [`${source}/mcp.json`],
        gateway: `${source}/mcp.json`,
        tools: [],
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("Selected gateway item has incompatible ChatJS metadata");
        return true;
      }
    );
    const dir = path.join(root, "chatjs/plugins/mcp");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "chatjs.json"),
      JSON.stringify({ contractVersion: 1, id: "mcp", kind: "plugin" })
    );
    expect(
      await planInstallation(root, {
        plugins: [`${source}/custom-service.json`],
        tools: [],
      })
    ).toMatchObject({ plugins: [{ id: "custom-service" }] });
    await rejects(
      planInstallation(root, {
        plugins: [],
        storage: { options: {}, source: `${source}/first.json` },
        tools: [],
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("Only one storage provider");
        return true;
      }
    );
    expect(
      await Bun.file(
        path.join(root, "chatjs/generated/installed-routers.ts")
      ).exists()
    ).toBe(false);
  } finally {
    await server.stop(true);
  }
});
