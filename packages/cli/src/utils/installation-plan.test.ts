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

test("plans transitive dependencies and repairs against the complete resulting installation without writing", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plan-"));
  roots.push(root);
  const reader = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "read-document",
    kind: "tool",
    tools: [{ toolExport: "readDocument" }],
  });
  const documents = toolDefinitionSchema.parse({
    contractVersion: 1,
    documentKind: "text",
    id: "text-documents",
    kind: "tool",
    requiresTools: ["readDocument"],
    tools: [{ toolExport: "createTextDocument" }],
  });
  const server = Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
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

    await rejects(
      planInstallation(
        root,
        {
          features: [],
          tools: [`${source}/text-documents.json`],
        },
        { documents: false, fresh: true }
      ),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("--no-documents");
        return true;
      }
    );
    expect(await Bun.file(path.join(root, "package.json")).exists()).toBe(
      false
    );
    const first = await planInstallation(root, {
      features: [],
      tools: [`${source}/text-documents.json`],
    });
    expect(
      first.expected
        .map((item: { readonly id: string }): string => item.id)
        .toSorted()
    ).toEqual(["read-document", "text-documents"]);
    expect(
      await Bun.file(path.join(root, "tools/chatjs/tools.ts")).exists()
    ).toBe(false);
    const dir = path.join(root, "tools/chatjs/text-documents");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "chatjs.json"), JSON.stringify(documents));
    await writeFile(
      path.join(dir, "document.tsx"),
      "export const documentUi = {};\n"
    );
    await writeFile(
      path.join(dir, "tool.ts"),
      "export const createTextDocument = {};\n"
    );
    await rejects(
      planInstallation(root, { features: [], tools: [] }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("requires installed tools: readDocument");
        return true;
      }
    );
    const repair = await planInstallation(root, {
      features: [],
      tools: [`${source}/read-document.json`],
    });
    expect(repair.expected).toEqual([reader]);
    expect(await readFile(path.join(dir, "tool.ts"), "utf-8")).toContain(
      "createTextDocument"
    );
  } finally {
    await server.stop(true);
  }
});

test("validates feature dependencies and exclusive storage slots before writing", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-plan-feature-"));
  roots.push(root);
  const server = Bun.serve({
    fetch(request: Readonly<Pick<Request, "url">>): Response {
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
    await rejects(
      planInstallation(root, {
        features: [`${source}/langfuse.json`],
        tools: [],
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("requires installed features: mcp");
        return true;
      }
    );
    const plan = await planInstallation(root, {
      features: [`${source}/mcp.json`, `${source}/langfuse.json`],
      tools: [],
    });
    expect(
      plan.features
        .map((feature: { readonly id: string }): string => feature.id)
        .toSorted()
    ).toEqual(["langfuse", "mcp"]);
    await rejects(
      planInstallation(root, {
        features: [`${source}/mcp.json`],
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
    const dir = path.join(root, "features/mcp");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "chatjs.json"),
      JSON.stringify({ contractVersion: 1, id: "mcp", kind: "feature" })
    );
    expect(
      await planInstallation(root, {
        features: [`${source}/langfuse.json`],
        tools: [],
      })
    ).toMatchObject({ features: [{ id: "langfuse" }] });
    await rejects(
      planInstallation(root, {
        features: [],
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
      await Bun.file(path.join(root, "features/installed-routers.ts")).exists()
    ).toBe(false);
  } finally {
    await server.stop(true);
  }
});
