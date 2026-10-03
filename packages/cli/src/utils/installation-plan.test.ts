import { afterEach, expect, test } from "bun:test";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { toolDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { planInstallation } from "./installation-plan";
/* oxlint-enable eslint/sort-imports */

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { join } = path;
const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("plans transitive dependencies and repairs against the complete resulting installation without writing", async (): Promise<void> => {
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
    expect(first.expected.map((item): string => item.id).toSorted()).toEqual([
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const definition = (id: string) =>
  toolDefinitionSchema.parse({
    contractVersion: 1,
    id,
    kind: "tool",
    slot: "codeExecution",
    tools: [{ toolExport: "executeCode" }],
  });
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("rejects conflicting provider selections and permits reinstalling the selected provider", async (): Promise<void> => {
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
    expect(
      fresh.replacements.map(({ previous }): string => previous.id)
    ).toEqual(["first"]);
    const reinstall = await planInstallation(root, {
      features: [],
      tools: [`http://127.0.0.1:${server.port}/first.json`],
    });
    expect(reinstall.expected).toEqual([definition("first")]);
  } finally {
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("validates feature dependencies and exclusive storage slots before writing", async (): Promise<void> => {
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(
      planInstallation(root, {
        features: [`${source}/langfuse.json`],
        tools: [],
      })
    ).resolves.toMatchObject({ features: [{ id: "langfuse" }] });
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
    // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
    server.stop(true);
  }
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
