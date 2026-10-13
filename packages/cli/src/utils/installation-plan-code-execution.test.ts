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

const definition = (
  id: string
): ReturnType<typeof toolDefinitionSchema.parse> =>
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
    fetch(request: Readonly<Pick<Request, "url">>): Response {
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
    await rejects(
      planInstallation(root, {
        features: [],
        tools: [`http://127.0.0.1:${server.port}/second.json`],
      }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("Only one codeExecution");
        return true;
      }
    );
    const fresh = await planInstallation(
      root,
      {
        features: [],
        tools: [`http://127.0.0.1:${server.port}/second.json`],
      },
      { fresh: true }
    );
    expect(
      fresh.replacements.map(
        ({
          previous,
        }: {
          readonly previous: { readonly id: string };
        }): string => previous.id
      )
    ).toEqual([]);
    const reinstall = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/first.json`],
    });
    expect(reinstall.expected).toEqual([definition("first")]);
  } finally {
    await server.stop(true);
  }
});

test("replaces an older executor descriptor but rejects newly requested providers without capabilities", async (): Promise<void> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-executor-upgrade-"));
  roots.push(root);
  const old = definition("previous-executor");
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
      const { codeExecutionCapabilities: capabilities, ...incomplete } =
        complete;
      return Response.json({
        meta: {
          chatjs: declared
            ? { ...incomplete, codeExecutionCapabilities: capabilities }
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
    await rejects(
      planInstallation(root, selection, { replace: true }),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("declared execution, cleanup and usage capabilities");
        return true;
      }
    );
    expect(await readFile(path.join(directory, "chatjs.json"), "utf-8")).toBe(
      installed
    );
  } finally {
    await server.stop(true);
  }
});
