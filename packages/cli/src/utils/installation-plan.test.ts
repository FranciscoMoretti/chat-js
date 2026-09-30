import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { toolDefinitionSchema } from "../../../registry/metadata";
import { planToolInstallation } from "./installation-plan";

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
    const first = await planToolInstallation(root, [
      `${source}/text-documents.json`,
    ]);
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
    await expect(planToolInstallation(root, [])).rejects.toThrow(
      "requires installed tools: readDocument"
    );
    const repair = await planToolInstallation(root, [
      `${source}/read-document.json`,
    ]);
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
      planToolInstallation(root, [
        `http://127.0.0.1:${server.port}/second.json`,
      ])
    ).rejects.toThrow("Only one codeExecution");
    const reinstall = await planToolInstallation(root, [
      `http://127.0.0.1:${server.port}/first.json`,
    ]);
    expect(reinstall.expected).toEqual([definition("first")]);
  } finally {
    server.stop(true);
  }
});
