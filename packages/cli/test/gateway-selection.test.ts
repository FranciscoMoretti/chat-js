import { afterAll, beforeAll, expect, it } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { fileURLToPath } from "node:url";

import gatewayPackage from "@chat-js/gateways/package.json";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { gatewayMetadata } from "../../registry/src/gateways/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import cliPackage from "../package.json";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { GATEWAYS } from "../src/types";
/* oxlint-enable import/no-relative-parent-imports */
import { externalGatewayFixture } from "./external-gateway";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import {
  nativeToolFixture,
  verifyNativeToolRuntime,
} from "./native-tool-fixture";
/* oxlint-enable import/max-dependencies */
import { run } from "./run-command";

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { dirname, join } = pathModule;

/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const originalRegistryUrl = process.env.CHATJS_REGISTRY_URL;
/* oxlint-enable node/no-process-env */
const root = await mkdtemp(join(tmpdir(), "chatjs-gateway-integration-"));
const packageDirectory = dirname(
  fileURLToPath(import.meta.resolve("@chat-js/gateways/package.json"))
);
const cliDirectory = join(import.meta.dir, "..");
const cliEntry = join(root, "cli/node_modules/@chat-js/cli/dist/index.js");
const archive = join(root, `chat-js-gateways-${gatewayPackage.version}.tgz`);

/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
afterAll(async () => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cleanupTimeout = Promise.withResolvers<never>();
  try {
    timeout = setTimeout(
      () => cleanupTimeout.reject(new Error("Gateway test cleanup timed out")),
      180_000
    );
    await Promise.race([
      rm(root, { force: true, recursive: true }),
      cleanupTimeout.promise,
    ]);
  } finally {
    clearTimeout(timeout);
  }
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */

const executionDefinition = {
  contractVersion: 1,
  envRequirements: [{ options: [["ACME_EXECUTION_TOKEN"]] }],
  id: "acme-execution",
  kind: "tool",
  slot: "codeExecution",
  tools: [{ rendererExport: "CommandRenderer", toolExport: "runCommand" }],
};
const external = externalGatewayFixture();
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const registryServer = Bun.serve({
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/paid-counter.json") {
      return Response.json(nativeToolFixture);
    }
    if (path === "/external-storage.json") {
      return Response.json({
        dependencies: ["files-sdk@2.1.0"],
        files: [
          {
            content: `import { memory } from "files-sdk/memory";
export function createStorageAdapter(options: {bucket: string}) {
  if (!options.bucket) throw new Error("Missing bucket");
  return memory();
}`,
            path: "provider.ts",
            target: "~/lib/storage-provider.ts",
            type: "registry:file",
          },
        ],
        meta: {
          chatjs: {
            configKeys: ["bucket"],
            contractVersion: 1,
            envRequirements: [{ options: [["ACME_STORAGE_TOKEN"]] }],
            id: "acme-bucket",
            kind: "storage",
          },
        },
        name: "acme-bucket",
        type: "registry:item",
      });
    }
    if (path === "/external-execution.json") {
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(executionDefinition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-execution/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import { defineTool } from "eve/tools";
import { z } from "zod";
export const runCommand = defineTool({description: "External fixture",inputSchema: z.object({command: z.string()}),
    execute: async ({command}) => ({stdout: command, exitCode: 0})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-execution/tool.ts",
            type: "registry:file",
          },
          {
            content: `"use client";
import { z } from "zod";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
export const CommandRenderer = defineToolRenderer({
 inputSchema: z.object({command: z.string()}), outputSchema: z.object({stdout: z.string(), exitCode: z.number()}),
 render: ({tool}) => <pre>{tool.state === "output-available" ? tool.output.stdout : tool.input?.command}</pre>,
});`,
            path: "renderer.tsx",
            target: "~/tools/chatjs/acme-execution/renderer.tsx",
            type: "registry:file",
          },
        ],
        meta: { chatjs: executionDefinition },
        name: "acme-execution",
        type: "registry:item",
      });
    }
    if (path === "/external-search.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [],
        id: "acme-search",
        kind: "tool",
        slot: "webSearch",
        tools: [{ toolExport: "lookup" }],
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-search/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import {defineTool} from "eve/tools";
import {z} from "zod";
export const lookup = defineTool({description: "External fixture",inputSchema: z.object({query: z.string()}), execute: async ({query}) => ({documents: [{text: query, href: "https://example.com"}]})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-search/tool.ts",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "acme-search",
        type: "registry:item",
      });
    }
    if (path === "/external-video.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_VIDEO_KEY"]] }],
        id: "acme-video",
        kind: "tool",
        slot: "generateVideo",
        tools: [{ toolExport: "animate" }],
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content:
              'import { defineTool } from "eve/tools"; import { z } from "zod"; export const animate = defineTool({description: "External fixture", inputSchema: z.object({ subject: z.string() }), execute: async ({subject}) => ({ asset: subject }) });',
            path: "tool.ts",
            target: "~/tools/chatjs/acme-video/tool.ts",
            type: "registry:file",
          },
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-video/chatjs.json",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "acme-video",
        type: "registry:item",
      });
    }
    if (path === "/external-image.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_IMAGE_KEY"]] }],
        id: "acme-image",
        kind: "tool",
        slot: "generateImage",
        tools: [{ toolExport: "paint" }],
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content:
              'import { defineTool } from "eve/tools"; import { z } from "zod"; export const paint = defineTool({description: "External fixture", inputSchema: z.object({ subject: z.string() }), execute: async ({subject}) => ({ asset: subject }) });',
            path: "tool.ts",
            target: "~/tools/chatjs/acme-image/tool.ts",
            type: "registry:file",
          },
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-image/chatjs.json",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "acme-image",
        type: "registry:item",
      });
    }
    if (path === "/external-retrieval.json") {
      const definition = {
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_RETRIEVAL_KEY"]] }],
        id: "acme-retrieval",
        kind: "tool",
        slot: "retrieveUrl",
        tools: [{ toolExport: "readPage" }],
      };
      return Response.json({
        dependencies: ["ai", "zod"],
        files: [
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/tools/chatjs/acme-retrieval/chatjs.json",
            type: "registry:file",
          },
          {
            content: `import {defineTool} from "eve/tools";
import {z} from "zod";
export const readPage = defineTool({description: "External fixture",inputSchema: z.object({target: z.string()}), execute: async ({target}) => ({text: "Page content", source: target})});`,
            path: "tool.ts",
            target: "~/tools/chatjs/acme-retrieval/tool.ts",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: definition.id,
        type: "registry:item",
      });
    }
    if (path === "/contracts.tgz") {
      return new Response(Bun.file(archive));
    }
    if (path === "/gateway.json") {
      return Response.json({
        ...external.root,
        dependencies: external.root.dependencies.map((dependency) =>
          dependency.startsWith("@chat-js/gateways@")
            ? // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
              `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
            : dependency
        ),
        registryDependencies: [
          // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
          `http://127.0.0.1:${registryServer.port}/adapter.json`,
        ],
      });
    }
    if (path === "/adapter.json") {
      return Response.json(external.adapter);
    }
    if (path === "/v1/chat/completions") {
      if (request.headers.get("authorization") !== "Bearer fixture-key") {
        return new Response("Unauthorized", { status: 401 });
      }
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      const body = await request.json();
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      if (body.model !== "gpt-5-mini") {
        return new Response("Wrong model", { status: 400 });
      }
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { content: "External gateway works.", role: "assistant" },
          },
        ],
        created: 1,
        id: "fixture-response",
        // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
        model: body.model,
        object: "chat.completion",
        usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
      });
    }
    if (/^\/[a-z0-9-]+\.json$/u.test(path)) {
      const file = Bun.file(
        join(cliDirectory, "../registry/dist/r", path.slice(1))
      );
      if (await file.exists()) {
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
        const item = await file.json();
        // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
        if (item.dependencies) {
          // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
          item.dependencies = item.dependencies.map((dependency: string) =>
            dependency.startsWith("@chat-js/gateways@")
              ? // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
                `@chat-js/gateways@http://127.0.0.1:${registryServer.port}/contracts.tgz`
              : dependency
          );
        }
        return Response.json(item);
      }
    }
    return new Response("Not found", { status: 404 });
  },
  hostname: "127.0.0.1",
  port: 0,
});
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
beforeAll(async () => {
  await run(packageDirectory, ["bun", "run", "build"]);
  await run(packageDirectory, ["bun", "pm", "pack", "--destination", root]);
  await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
  const output = join(cliDirectory, "../registry/dist/r");
  const outputNames = await readdir(output);
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const names = outputNames.toSorted();
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const first = await Promise.all(
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    names.map((name) => readFile(join(output, name), "utf-8"))
  );
  await run(join(cliDirectory, "../registry"), ["bun", "run", "build"]);
  const rebuiltOutputNames = await readdir(output);
  // oxlint-disable-next-line typescript/no-unsafe-call -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(rebuiltOutputNames.toSorted()).toEqual(names);
  expect(
    await Promise.all(
      // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      names.map((name) => readFile(join(output, name), "utf-8"))
    )
  ).toEqual(first);
  await run(cliDirectory, ["bun", "run", "build"]);
  await run(cliDirectory, ["bun", "pm", "pack", "--destination", root]);
  await mkdir(join(root, "cli"));
  await writeFile(
    join(root, "cli/package.json"),
    JSON.stringify({
      dependencies: {
        "@chat-js/cli": `file:${join(root, `chat-js-cli-${cliPackage.version}.tgz`)}`,
      },
      overrides: { "@chat-js/gateways": `file:${archive}` },
      private: true,
    })
  );
  await run(join(root, "cli"), ["bun", "install"]);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  process.env.CHATJS_REGISTRY_URL = `http://127.0.0.1:${registryServer.port}/{name}.json`;
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
afterAll(() => {
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  registryServer.stop(true);
  if (originalRegistryUrl === undefined) {
    delete process.env.CHATJS_REGISTRY_URL;
  } else {
    process.env.CHATJS_REGISTRY_URL = originalRegistryUrl;
  }
});
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-undefined */

const gatewaySource = (gateway: string): string =>
  // oxlint-disable-next-line typescript/no-unsafe-return -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  gateway === "acme"
    ? // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/gateway.json`
    : gateway;

const storageArguments = (gateway: string): string[] => {
  if (gateway === "acme") {
    return [
      "--storage-provider",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-storage.json`,
      "--storage-config",
      '{"bucket":"test"}',
    ];
  }
  if (gateway === "openai") {
    return [
      "--storage-provider",
      "s3",
      "--storage-config",
      '{"bucket":"test","region":"us-east-1"}',
    ];
  }
  return [];
};

const toolArguments = (gateway: string): string[] => {
  if (gateway === "vercel") {
    return [
      "--video-generation-tool",
      "generate-video",
      "--image-generation-tool",
      "generate-image",
      "--search-tool",
      "firecrawl-search",
      "--code-execution-tool",
      "vercel-code-execution",
      "--url-retrieval-tool",
      "retrieve-url",
    ];
  }
  if (gateway === "acme") {
    return [
      "--video-generation-tool",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-video.json`,
      "--image-generation-tool",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-image.json`,
      "--url-retrieval-tool",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-retrieval.json`,
      "--code-execution-tool",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-execution.json`,
      "--search-tool",
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      `http://127.0.0.1:${registryServer.port}/external-search.json`,
    ];
  }
  return [];
};

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const verifyResearchInstallation = async (cwd: string, gateway: string) => {
  expect(
    await Bun.file(join(cwd, "agent/tools/deepResearch.ts")).exists()
  ).toBe(false);
  if (gateway === "vercel") {
    await run(join(cwd, "electron"), ["bun", "install", "--ignore-scripts"]);
    await run(cwd, ["bun", "run", "lint"]);
    expect(
      await Bun.file(join(cwd, "agent/tools/confirm_note.ts")).exists()
    ).toBe(false);
    expect(
      await Bun.file(join(cwd, "tools/chatjs/delete-document/tool.ts")).exists()
    ).toBe(false);
    await run(cwd, ["node", cliEntry, "add", "delete-document", "--yes"]);
    expect(
      await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
    ).toContain('from "./delete-document/tool"');
    expect(
      await readFile(join(cwd, "tools/chatjs/tool-availability.ts"), "utf-8")
    ).toContain("deleteDocumentAvailable");
    // Exercise namespaced transitive dependencies, including the shared UI item
    // without a ChatJS tool descriptor, through actual installation and sync.
    const sharedDirectory = join(cwd, "tools/chatjs/_shared/code-execution");
    await rm(sharedDirectory, { force: true, recursive: true });
    await run(cwd, ["node", cliEntry, "add", "saved-code-execution", "--yes"]);
    expect(
      await Bun.file(join(sharedDirectory, "interactive-charts.tsx")).exists()
    ).toBe(true);
    expect(
      await Bun.file(
        join(cwd, "tools/chatjs/code-execution-ui/chatjs.json")
      ).exists()
    ).toBe(false);
    const registered = await readFile(
      join(cwd, "tools/chatjs/tools.ts"),
      "utf-8"
    );
    expect(registered).toContain('from "./saved-code-execution/tool"');
    expect(registered).toContain('from "./code-documents/tool"');
    expect(registered).toContain('from "./read-document/tool"');
    await run(cwd, ["node", cliEntry, "add", "deep-research", "--yes"]);
    expect(
      await Bun.file(join(cwd, "agent/tools/deepResearch.ts")).exists()
    ).toBe(true);
    expect(
      await Bun.file(
        join(cwd, "agent/subagents/researcher/tools/webSearch.ts")
      ).exists()
    ).toBe(true);
    expect(
      await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
    ).not.toContain('from "./deep-research/tool"');
    expect(await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")).toContain(
      'from "./deep-research/renderer"'
    );
  }
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
for (const gateway of [...GATEWAYS, "acme"]) {
  const electronFlag = gateway === "vercel" ? "--electron" : "--no-electron";
  it(`${gateway}: independently installed ChatJS app typechecks and loads the registry adapter`, async () => {
    const cwd = join(root, gateway);
    await run(root, [
      "node",
      cliEntry,
      "create",
      gateway,
      "--gateway",
      gatewaySource(gateway),
      ...storageArguments(gateway),
      "--yes",
      electronFlag,
      ...toolArguments(gateway),
    ]);
    await verifyResearchInstallation(cwd, gateway);
    expect(
      await Bun.file(join(cwd, "tools/platform/generate-image.ts")).exists()
    ).toBe(false);
    expect(
      await Bun.file(join(cwd, "components/part/generate-image.tsx")).exists()
    ).toBe(false);
    if (gateway !== "vercel") {
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/generate-image/tool.ts")
        ).exists()
      ).toBe(false);
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("generate-image/renderer");
    }
    expect(
      await Bun.file(join(cwd, "tests/eve-sandbox-lifecycle.e2e.ts")).exists()
    ).toBe(false);
    if (gateway === "vercel" || gateway === "acme") {
      expect(await readFile(join(cwd, "chat.config.ts"), "utf-8")).toMatch(
        /image:\s*\{[^}]*\bdefault:\s*"[^"\n]+"/u
      );
    }
    expect(
      await Bun.file(join(cwd, "tools/platform/generate-video.ts")).exists()
    ).toBe(false);
    expect(
      await Bun.file(join(cwd, "components/part/generate-video.tsx")).exists()
    ).toBe(false);
    expect(
      await Bun.file(join(cwd, "tools/chatjs/generate-video/tool.ts")).exists()
    ).toBe(gateway === "vercel");
    if (gateway === "vercel") {
      expect(await readFile(join(cwd, "chat.config.ts"), "utf-8")).toMatch(
        /video:\s*\{[^}]*\bdefault:\s*"[^"\n]+"/u
      );
    }
    expect(await readFile(join(cwd, "chat.config.ts"), "utf-8")).not.toMatch(
      /(?:image|video):\s*\{[^}]*\benabled:/u
    );
    const manifestPath = join(cwd, "package.json");
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    if (gateway === "vercel") {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@vercel/sandbox"]).toBeDefined();
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/generate-image/tool.ts")
        ).exists()
      ).toBe(true);
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).toContain("generate-image/renderer");
      expect(
        await readFile(
          join(cwd, "tools/chatjs/retrieve-url/chatjs.json"),
          "utf-8"
        )
      ).toContain("FIRECRAWL_API_KEY");
      expect(
        await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()
      ).toBe(true);
      expect(
        await readFile(join(cwd, "tools/chatjs/providers.ts"), "utf-8")
      ).toContain("vercel-code-execution/tool");
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
      expect(
        await Bun.file(join(cwd, "tools/chatjs/tavily-search/tool.ts")).exists()
      ).toBe(false);
      expect(
        await readFile(join(cwd, "tools/chatjs/providers.ts"), "utf-8")
      ).toContain("firecrawl-search/tool");
      expect(
        await readFile(
          join(cwd, "tools/chatjs/firecrawl-search/chatjs.json"),
          "utf-8"
        )
      ).toContain("FIRECRAWL_API_KEY");
    }

    const selectedSdk =
      gateway === "acme"
        ? "@ai-sdk/openai-compatible"
        : // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
          gatewayMetadata[gateway as keyof typeof gatewayMetadata].dependency;
    for (const { dependency } of Object.values(gatewayMetadata)) {
      if (dependency !== selectedSdk) {
        // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
        expect(manifest.dependencies[dependency]).toBeUndefined();
      }
    }
    // The shared npm archive must not carry any other adapter implementations.
    await Promise.all(
      GATEWAYS.map(async (name) => {
        expect(
          await Bun.file(
            join(cwd, "node_modules/@chat-js/gateways/src", `${name}.ts`)
          ).exists()
        ).toBe(false);
        expect(
          await Bun.file(
            join(cwd, "node_modules/@chat-js/gateways/dist", `${name}.js`)
          ).exists()
        ).toBe(false);
      })
    );

    if (gateway === "acme") {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@vercel/sandbox"]).toBeUndefined();
      expect(
        await readFile(
          join(cwd, "tools/chatjs/acme-video/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_VIDEO_KEY");
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("tool-generateVideo");
      expect(
        await readFile(
          join(cwd, "tools/chatjs/acme-image/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_IMAGE_KEY");
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
      expect(
        await Bun.file(
          join(cwd, "tools/platform/code-execution-contract.ts")
        ).exists()
      ).toBe(false);
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).toContain("acme-execution/renderer");
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("tool-webSearch");
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/vercel-code-execution/tool.ts")
        ).exists()
      ).toBe(false);
      expect(
        await readFile(
          join(cwd, "tools/chatjs/acme-execution/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_EXECUTION_TOKEN");
      await writeFile(
        join(cwd, "verify-execution.ts"),
        `import assert from "node:assert/strict";
import {tools} from "./tools/chatjs/tools";
import type { ToolContext } from "eve/tools";
const unavailable = () => { throw new Error("Unexpected resource access"); };
const context: ToolContext = { callId: "fixture", toolName: "fixture", abortSignal: new AbortController().signal, session: { id: "fixture", auth: { current: null, initiator: null }, turn: { id: "turn", sequence: 0 } }, getSandbox: unavailable, getSkill: unavailable, getToken: unavailable, requireAuth: unavailable };
const tool = tools.codeExecution;
assert.ok(tool.execute);
const result = await tool.execute({command: "echo hello"}, context);
assert.deepEqual(result, {stdout: "echo hello", exitCode: 0});
assert.ok(tools.webSearch.execute);
const search = await tools.webSearch.execute({query: "independent schema"}, context);
assert.deepEqual(search, {documents: [{text: "independent schema", href: "https://example.com"}]});
assert.ok(tools.retrieveUrl.execute);
assert.ok(tools.generateVideo.execute);
assert.deepEqual(await tools.generateVideo.execute({subject: "ocean"}, context), {asset: "ocean"});
assert.ok(tools.generateImage.execute);
assert.deepEqual(await tools.generateImage.execute({subject: "mountains"}, context), {asset: "mountains"});
const page = await tools.retrieveUrl.execute({target: "https://example.com"}, context);
assert.deepEqual(page, {text: "Page content", source: "https://example.com"});
`
      );
      await run(cwd, ["env", "PLAYWRIGHT=True", "bun", "verify-execution.ts"]);
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@mendable/firecrawl-js"]).toBeUndefined();
      expect(
        await Bun.file(join(cwd, "tools/chatjs/retrieve-url/tool.ts")).exists()
      ).toBe(false);
      expect(
        await readFile(
          join(cwd, "tools/chatjs/acme-retrieval/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_RETRIEVAL_KEY");
      expect(
        await readFile(join(cwd, "tools/chatjs/ui.ts"), "utf-8")
      ).not.toContain("tool-retrieveUrl");
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeUndefined();
      await writeFile(
        join(cwd, "verify-storage.ts"),
        `import { Files } from "files-sdk";
import { createStorageAdapter } from "./lib/storage-provider";
import { storageOptions, storageId, storageEnvRequirements } from "./lib/storage-options";
import assert from "node:assert/strict";
assert.equal(storageId, "acme-bucket");
assert.equal(storageEnvRequirements[0]?.options[0]?.[0], "ACME_STORAGE_TOKEN");
const files = new Files({adapter: createStorageAdapter(storageOptions)});
await files.upload("test.txt", new Blob(["hello"]));
assert.equal(await (await files.download("test.txt")).text(), "hello");
await files.delete("test.txt");
assert.equal(await files.exists("test.txt"), false);
`
      );
      await run(cwd, ["bun", "verify-storage.ts"]);
    }
    if (gateway === "openai") {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeDefined();
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
    }

    const other = gateway === "vercel" ? "openai" : "vercel";
    await writeFile(
      join(cwd, "gateway-type-check.ts"),
      `import { defineConfig } from "./lib/config-schema";
// @ts-expect-error An uninstalled gateway must not typecheck.
defineConfig({ ai: { gateway: "${other}" } });
${
  gateway === "vercel" || gateway === "openai"
    ? `// @ts-expect-error Preserve the selected SDK's model ID type across package declarations.
defineConfig({ ai: { gateway: "${gateway}", workflows: { chat: "not-a-model" } } });`
    : ""
}
${
  gateway === "vercel"
    ? ""
    : `// @ts-expect-error This gateway has no video model IDs.
defineConfig({ ai: { gateway: "${gateway}", tools: { video: { default: "video" } } } });`
}
`
    );
    if (gateway === "vercel") {
      await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
      const index = await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8");
      await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
      expect(await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")).toBe(
        index
      );
      await run(cwd, [
        "bunx",
        "--bun",
        "shadcn@4.21.0",
        "add",
        "@chatjs/get-weather",
        "--yes",
      ]);
      await run(cwd, ["node", cliEntry, "sync"]);
      expect(
        await readFile(join(cwd, "tools/chatjs/tools.ts"), "utf-8")
      ).toContain("getWeather as tool");
    }
    await run(cwd, ["bun", "run", "test:types"]);
    await writeFile(
      join(cwd, "probe.ts"),
      `import { Gateway } from "./lib/ai/gateway";
import assert from "node:assert/strict";
assert.equal(new Gateway().type, "${gateway}");
`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe.ts"]);

    if (gateway === "acme") {
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- The local registry fixture exposes the bound server port used by this generated probe. The local fixture serves generated registry JSON and preserves the runtime checks used by the integration test.
      const registryPort: number = registryServer.port;
      await writeFile(
        join(cwd, "probe-generation.ts"),
        `import assert from "node:assert/strict";
import { generateText } from "ai";
process.env.DATABASE_URL = "postgres://fixture:fixture@127.0.0.1/fixture";
process.env.AUTH_SECRET = "fixture-secret";
process.env.EVE_GATEWAY_SECRET = "fixture-eve-gateway-secret-at-least-32-characters";
process.env.EVE_INTERNAL_ORIGIN = "http://localhost:3000";
process.env.WORKFLOW_POSTGRES_URL = process.env.DATABASE_URL;
process.env.ACME_BASE_URL = "http://127.0.0.1:${registryPort}/v1";
process.env.ACME_API_KEY = "fixture-key";
const { getActiveGateway } = await import("./lib/ai/active-gateway");
const result = await generateText({ model: getActiveGateway().createLanguageModel("gpt-5-mini"), prompt: "Hello" });
assert.equal(result.text, "External gateway works.");
`
      );
      await run(cwd, ["bunx", "--no-install", "tsx", "probe-generation.ts"]);
    }

    // Parse the actual generated config, including model defaults, without provider calls.
    await writeFile(
      join(cwd, "probe-config.ts"),
      `import { getProvider } from "files-sdk/providers";
import config from "./chat.config";
import { applyDefaults, aiConfigSchema } from "./lib/config-schema";
import assert from "node:assert/strict";
assert.ok(getProvider("vercel-blob"));
assert.equal(applyDefaults(config).ai.gateway, "${gateway}");
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, tools: { ...applyDefaults(config).ai.tools, image: {} } }).success, true);
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, gateway: "${other}" }).success, false);
${
  gateway === "vercel"
    ? ""
    : `const ai = applyDefaults(config).ai;
assert.equal(aiConfigSchema.safeParse({ ...ai, tools: { ...ai.tools, video: {} } }).success, true);`
}

`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe-config.ts"]);
    if (gateway === "vercel") {
      await Promise.all(
        ["gateway-type-check.ts", "probe.ts", "probe-config.ts"].map((name) =>
          rm(join(cwd, name))
        )
      );
      await run(cwd, ["bun", "run", "lint"]);
      // Core omission, then all optional implementations through one shared add plan.
      const omittedObservability = await Promise.all(
        ["vercel-analytics", "vercel-speed-insights", "langfuse"].map((id) =>
          Bun.file(join(cwd, `features/${id}/chatjs.json`)).exists()
        )
      );
      expect(omittedObservability).toEqual([false, false, false]);
      expect(
        await Bun.file(
          join(cwd, "app/(chat)/api/files/upload/route.ts")
        ).exists()
      ).toBe(false);
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "attachment-uploads",
        "mcp",
        "vercel-analytics",
        "vercel-speed-insights",
        "langfuse",
        "--yes",
      ]);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["node", cliEntry, "sync"]);
      expect(
        await Bun.file(
          join(cwd, "app/(chat)/api/files/upload/route.ts")
        ).exists()
      ).toBe(true);
      expect(
        await readFile(
          join(cwd, "tools/chatjs/vercel-code-execution/execution-sandbox.ts"),
          "utf-8"
        )
      ).toContain('from "@/lib/env"');
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["bun", "run", "lint"]);
      expect(
        await readFile(join(cwd, "features/installed.ts"), "utf-8")
      ).toContain("langfuse");
      expect(
        await readFile(join(cwd, "features/installed-layout.ts"), "utf-8")
      ).toContain("vercel-speed-insights");
      expect(
        await readFile(join(cwd, "features/installed-uploads.ts"), "utf-8")
      ).toContain("attachmentUploads");
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(
        run(cwd, ["node", cliEntry, "add", "tavily-search", "--yes"])
      ).rejects.toThrow("--replace");
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "tavily-search",
        "--replace",
        "--yes",
      ]);
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/firecrawl-search/chatjs.json")
        ).exists()
      ).toBe(false);
      const searchSource = join(cwd, "tools/chatjs/tavily-search/tool.ts");
      const originalSearch = await readFile(searchSource, "utf-8");
      await writeFile(
        searchSource,
        `// customized provider
${originalSearch}`
      );
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(
        run(cwd, [
          "node",
          cliEntry,
          "add",
          "firecrawl-search",
          "--replace",
          "--yes",
        ])
      ).rejects.toThrow("--overwrite");
      expect(await readFile(searchSource, "utf-8")).toContain(
        "customized provider"
      );
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "firecrawl-search",
        "--replace",
        "--overwrite",
        "--yes",
      ]);
      expect(
        await Bun.file(
          join(cwd, "tools/chatjs/vercel-code-execution/tool.ts")
        ).exists()
      ).toBe(true);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["node", cliEntry, "sync"]);
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["bun", "run", "lint"]);
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(
        run(cwd, [
          "node",
          cliEntry,
          "add",
          "--storage-provider",
          "s3",
          "--storage-config",
          '{"bucket":"replacement","region":"us-east-1"}',
          "--yes",
        ])
      ).rejects.toThrow("--replace");
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "--storage-provider",
        "s3",
        "--storage-config",
        '{"bucket":"replacement","region":"us-east-1"}',
        "--replace",
        "--yes",
      ]);
      const storageOptions = await readFile(
        join(cwd, "lib/storage-options.ts"),
        "utf-8"
      );
      expect(storageOptions).toContain("replacement");
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "--storage-provider",
        "s3",
        "--yes",
      ]);
      expect(await readFile(join(cwd, "lib/storage-options.ts"), "utf-8")).toBe(
        storageOptions
      );
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["bun", "run", "lint"]);
      const longDirectory = join(cwd, "tools/chatjs/long-renderer");
      await mkdir(longDirectory);
      const toolExport =
        "wordCountWithAnIntentionallyLongNameForFormattingVerification";
      const rendererExport =
        "WordCountRendererWithAnIntentionallyLongNameForFormattingVerification";
      await writeFile(
        join(longDirectory, "tool.ts"),
        `/* oxlint-disable import/no-relative-parent-imports -- This fixture reexports the installed word-count implementation under an intentionally long name to verify generated import formatting. */\nexport { wordCount as ${toolExport} } from "../word-count/tool";\n/* oxlint-enable import/no-relative-parent-imports */\n`
      );
      await writeFile(
        join(longDirectory, "renderer.tsx"),
        `/* oxlint-disable import/no-relative-parent-imports -- This fixture reexports the installed word-count implementation under an intentionally long name to verify generated import formatting. */\nexport { WordCountRenderer as ${rendererExport} } from "../word-count/renderer";\n/* oxlint-enable import/no-relative-parent-imports */\n`
      );
      await writeFile(
        join(longDirectory, "chatjs.json"),
        JSON.stringify({
          contractVersion: 1,
          id: "long-renderer",
          kind: "tool",
          tools: [{ rendererExport, toolExport }],
        })
      );
      await run(cwd, ["node", cliEntry, "sync"]);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["node", cliEntry, "sync"]);
      await run(cwd, ["bun", "run", "lint"]);
    }
    expect(
      await Bun.file(
        join(cwd, "lib/ai/gateways/openrouter-gateway.ts")
      ).exists()
    ).toBe(false);
  }, 180_000);
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
it("native tools: a minimal scaffold installs external EVE tools and preserves durable usage", async () => {
  const cwd = join(root, "native");
  await run(root, [
    "node",
    cliEntry,
    "create",
    "native",
    "--gateway",
    "openai",
    "--yes",
    "--no-electron",
  ]);
  await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
  await run(cwd, [
    "node",
    cliEntry,
    "add",
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    `http://127.0.0.1:${registryServer.port}/paid-counter.json`,
    "--yes",
  ]);
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const manifest = JSON.parse(
    await readFile(join(cwd, "package.json"), "utf-8")
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(manifest.dependencies["@vercel/sandbox"]).toBeUndefined();
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(manifest.dependencies["@tavily/core"]).toBeUndefined();
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(manifest.dependencies["@mendable/firecrawl-js"]).toBeUndefined();
  await run(cwd, ["bun", "run", "test:types"]);
  await verifyNativeToolRuntime(cwd);
}, 240_000);
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
for (const installAtCreation of [false, true]) {
  it(`MCP: create ${installAtCreation ? "with" : "without"} MCP and add preserve core, UI order and setup errors`, async () => {
    const name = `mcp-${installAtCreation ? "installed" : "omitted"}`;
    const cwd = join(root, name);
    await run(root, [
      "node",
      cliEntry,
      "create",
      name,
      "--gateway",
      "openai",
      "--yes",
      "--no-electron",
      installAtCreation ? "--mcp" : "--no-mcp",
      ...(installAtCreation
        ? [
            "--attachments",
            "--observability",
            "vercel-analytics,vercel-speed-insights,langfuse",
          ]
        : []),
    ]);
    for (const file of [
      "app/(chat)/api/files/upload/route.ts",
      "features/vercel-speed-insights/chatjs.json",
      "features/langfuse/chatjs.json",
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Verify each optional creation flag installs source.
      expect(await Bun.file(join(cwd, file)).exists()).toBe(installAtCreation);
    }
    const source = "app/api/mcp/oauth/callback/route.ts";
    expect(await Bun.file(join(cwd, source)).exists()).toBe(installAtCreation);
    expect(await readFile(join(cwd, "lib/db/schema.ts"), "utf-8")).toContain(
      '"McpConnector"'
    );
    expect(
      await Bun.file(join(cwd, "components/eve/eve-mcp-result.tsx")).exists()
    ).toBe(true);
    expect(await readFile(join(cwd, "chat.config.ts"), "utf-8")).not.toMatch(
      /\bmcp:/u
    );
    if (!installAtCreation) {
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["node", cliEntry, "add", "mcp", "--yes"]);
    }
    expect(await Bun.file(join(cwd, source)).exists()).toBe(true);
    expect(
      await readFile(join(cwd, "features/installed-routers.ts"), "utf-8")
    ).toContain("mcp: mcpRouter");
    const composer = await readFile(join(cwd, "composer-controls.ts"), "utf-8");
    const settings = await readFile(join(cwd, "settings-items.ts"), "utf-8");
    await run(cwd, ["node", cliEntry, "sync"]);
    expect(await readFile(join(cwd, "composer-controls.ts"), "utf-8")).toBe(
      composer
    );
    expect(await readFile(join(cwd, "settings-items.ts"), "utf-8")).toBe(
      settings
    );
    await run(cwd, ["bun", "run", "test:types"]);
    await writeFile(
      join(cwd, "mcp-setup-probe.ts"),
      `import assert from "node:assert/strict";
import descriptor from "./features/mcp/chatjs.json";
import { requireCredentials } from "./lib/required-credentials";
assert.throws(() => requireCredentials("mcp", descriptor.envRequirements, {NODE_ENV: "test"}), /Missing credentials for mcp: MCP_ENCRYPTION_KEY/);
requireCredentials("mcp", descriptor.envRequirements, {NODE_ENV: "test", MCP_ENCRYPTION_KEY: "test"});
`
    );
    await run(cwd, ["bun", "mcp-setup-probe.ts"]);
    if (!installAtCreation) {
      const previousConfig = `${await readFile(join(cwd, "chat.config.ts"), "utf-8")}\n// User model configuration remains editable.\n`;
      await writeFile(join(cwd, "chat.config.ts"), previousConfig);
      const catalog = join(cwd, "lib/ai/models.generated.ts");
      await writeFile(
        catalog,
        `${await readFile(catalog, "utf-8")}\n// Refreshed model catalog.\n`
      );
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(
        run(cwd, [
          "node",
          cliEntry,
          "add",
          "--gateway",
          "openai-compatible",
          "--yes",
        ])
      ).rejects.toThrow("--replace");
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "--gateway",
        "openai-compatible",
        "--replace",
        "--yes",
      ]);
      // A gateway-generated env update must not look like a user edit during
      // a subsequent storage replacement.
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "--storage-provider",
        "s3",
        "--storage-config",
        '{"bucket":"after-gateway","region":"us-east-1"}',
        "--replace",
        "--yes",
      ]);
      expect(
        await readFile(join(cwd, "lib/storage-options.ts"), "utf-8")
      ).toContain("after-gateway");
      const nextConfig = await readFile(join(cwd, "chat.config.ts"), "utf-8");
      expect(nextConfig).toBe(
        previousConfig.replace(
          'gateway: "openai"',
          'gateway: "openai-compatible"'
        )
      );
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["bun", "run", "test:types"]);
    }
    const computedComposer = composer
      .replace(/[=]\s*\[/u, "= Array.from([")
      .replace(/\];\s*$/u, "]);\n");
    const computedSettings = settings
      .replace(/[=]\s*\[/u, "= Array.from([")
      .replace(/\];\s*$/u, "]);\n");
    await writeFile(join(cwd, "composer-controls.ts"), computedComposer);
    await writeFile(join(cwd, "settings-items.ts"), computedSettings);
    await run(cwd, ["node", cliEntry, "add", "word-count", "--yes"]);
    expect(await readFile(join(cwd, "composer-controls.ts"), "utf-8")).toBe(
      computedComposer
    );
    expect(await readFile(join(cwd, "settings-items.ts"), "utf-8")).toBe(
      computedSettings
    );
  }, 180_000);
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
