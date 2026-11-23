import { testFullInstallation } from "./full-installation";
import { rejects } from "node:assert/strict";
import { parsePackageJson } from "../src/helpers/package-manifest";
import { requireJsonObject } from "../src/helpers/json-object";
import { afterAll, beforeAll, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { gatewayMetadata } from "../../registry/src/gateways/metadata";
import cliPackage from "../package.json";
import { GATEWAYS } from "../src/types";
import { externalGatewayFixture } from "./external-gateway";
import { cleanupGatewayFixture } from "./gateway-cleanup";
import {
  nativeToolFixture,
  verifyNativeToolRuntime,
} from "./native-tool-fixture";
import { run } from "./run-command";
import { testChatPluginSelections } from "./chat-plugin-selection";

const originalRegistryUrl = process.env.CHATJS_REGISTRY_URL;
const root = await mkdtemp(
  nodePath.join(tmpdir(), "chatjs-gateway-integration-")
);
const cliDirectory = nodePath.join(import.meta.dir, "..");
const cliEntry = nodePath.join(root, "cli/node_modules/chat-js/dist/index.js");

const removeFixtureFiles = async (): Promise<void> => {
  if (process.env.CHATJS_KEEP_GATEWAY_FIXTURE === "1") {
    process.stderr.write(`Preserved gateway fixture: ${root}\n`);
    return;
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cleanupTimeout = Promise.withResolvers<never>();
  try {
    timeout = setTimeout(() => {
      cleanupTimeout.reject(new Error("Gateway test cleanup timed out"));
    }, 180_000);
    await Promise.race([
      rm(root, { force: true, recursive: true }),
      cleanupTimeout.promise,
    ]);
  } finally {
    clearTimeout(timeout);
  }
};

const external = externalGatewayFixture();
const registryServer = Bun.serve({
  async fetch(
    request: Readonly<Pick<Request, "url" | "json">> & {
      readonly headers: Readonly<Pick<Headers, "get">>;
    }
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/paid-counter.json") {
      return Response.json(nativeToolFixture);
    }
    if (path === "/external-storage.json") {
      return Response.json({
        dependencies: ["files-sdk@2.5.0"],
        files: [
          {
            content: `import { memory } from "files-sdk/memory";
export function createStorageAdapter(options: {bucket: string}) {
  if (!options.bucket) throw new Error("Missing bucket");
  return memory();
}`,
            path: "provider.ts",
            target: "~/chatjs/providers/storage.ts",
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
            target: "~/chatjs/tools/acme-video/tool.ts",
            type: "registry:file",
          },
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/chatjs/tools/acme-video/chatjs.json",
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
            target: "~/chatjs/tools/acme-image/tool.ts",
            type: "registry:file",
          },
          {
            content: JSON.stringify(definition),
            path: "chatjs.json",
            target: "~/chatjs/tools/acme-image/chatjs.json",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "acme-image",
        type: "registry:item",
      });
    }
    if (path === "/gateway.json") {
      return Response.json({
        ...external.root,
        registryDependencies: [
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
      const body = requireJsonObject(
        await request.json(),
        "chat completion request"
      );
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
        model: body.model,
        object: "chat.completion",
        usage: { completion_tokens: 1, prompt_tokens: 1, total_tokens: 2 },
      });
    }
    if (/^\/[a-z0-9-]+\.json$/u.test(path)) {
      const file = Bun.file(
        nodePath.join(cliDirectory, "../registry/dist/r", path.slice(1))
      );
      if (await file.exists()) {
        return new Response(file);
      }
    }
    return new Response("Not found", { status: 404 });
  },
  hostname: "127.0.0.1",
  port: 0,
});

beforeAll(async () => {
  await run(nodePath.join(cliDirectory, "../registry"), [
    "bun",
    "run",
    "build",
  ]);
  const output = nodePath.join(cliDirectory, "../registry/dist/r");
  const registryFiles = new Bun.Glob("**/*");
  const outputNames = [
    ...registryFiles.scanSync({ cwd: output, onlyFiles: true }),
  ];
  const names = outputNames.toSorted();
  const first = await Promise.all(
    names.map(
      async (name) => await readFile(nodePath.join(output, name), "utf-8")
    )
  );
  await run(nodePath.join(cliDirectory, "../registry"), [
    "bun",
    "run",
    "build",
  ]);
  const rebuiltOutputNames = [
    ...registryFiles.scanSync({ cwd: output, onlyFiles: true }),
  ];
  expect(rebuiltOutputNames.toSorted()).toEqual(names);
  expect(
    await Promise.all(
      names.map(
        async (name) => await readFile(nodePath.join(output, name), "utf-8")
      )
    )
  ).toEqual(first);
  await run(cliDirectory, ["bun", "run", "build"]);
  await run(cliDirectory, ["bun", "pm", "pack", "--destination", root]);
  await mkdir(nodePath.join(root, "cli"));
  await writeFile(
    nodePath.join(root, "cli/package.json"),
    JSON.stringify({
      dependencies: {
        "chat-js": `file:${nodePath.join(root, `chat-js-${cliPackage.version}.tgz`)}`,
      },
      private: true,
    })
  );
  await run(nodePath.join(root, "cli"), ["bun", "install"]);
  process.env.CHATJS_REGISTRY_URL = `http://127.0.0.1:${registryServer.port}/{name}.json`;
});

afterAll(async () => {
  await cleanupGatewayFixture({
    environment: process.env,
    originalRegistryUrl,
    removeFiles: removeFixtureFiles,
    server: registryServer,
  });
});

const gatewaySource = (gateway: string): string => {
  if (gateway === "acme") {
    return `http://127.0.0.1:${registryServer.port}/gateway.json`;
  }
  return gateway;
};

const storageArguments = (gateway: string): string[] => {
  if (gateway === "acme") {
    return [
      "--storage-provider",
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

it.each([
  [
    "unsupported-video",
    "openai",
    "--video-generation-tool",
    "generate-video",
    "vercel-blob",
    "supporting video",
  ],
  [
    "memory-image",
    "vercel",
    "--image-generation-tool",
    "generate-image",
    "memory",
    "persistent storage",
  ],
])(
  "rejects invalid create before writing source: %s",
  async (name, gateway, flag, tool, storage, message) => {
    await rejects(
      run(root, [
        "node",
        cliEntry,
        "create",
        name,
        "--yes",
        "--no-electron",
        "--gateway",
        gateway,
        flag,
        tool,
        "--storage-provider",
        storage,
        "--storage-config",
        "{}",
      ]),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow(message);
        return true;
      }
    );
    expect(
      await Bun.file(nodePath.join(root, name, "package.json")).exists()
    ).toBe(false);
  }
);
const toolArguments = (gateway: string): string[] => {
  if (gateway === "vercel") {
    return [
      "--mcp",
      "--attachments",
      "--video-generation-tool",
      "generate-video",
      "--image-generation-tool",
      "generate-image",
      "--sandbox-provider",
      "vercel",
    ];
  }
  if (gateway === "acme") {
    return [
      "--video-generation-tool",
      `http://127.0.0.1:${registryServer.port}/external-video.json`,
      "--image-generation-tool",
      `http://127.0.0.1:${registryServer.port}/external-image.json`,
    ];
  }
  return [];
};

const verifyGatewayInstallation = async (cwd: string, gateway: string) => {
  expect(
    await Bun.file(nodePath.join(cwd, "agent/tools/deepResearch.ts")).exists()
  ).toBe(false);
  if (gateway === "vercel") {
    const beforeGateway = await readFile(
      nodePath.join(cwd, "chatjs/providers/gateway-defaults.ts"),
      "utf-8"
    );

    await rejects(
      run(cwd, [
        "node",
        cliEntry,
        "add",
        "--gateway",
        "openai",
        "--replace",
        "--yes",
      ]),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("supporting video");
        return true;
      }
    );

    await rejects(
      run(cwd, [
        "node",
        cliEntry,
        "add",
        "--storage-provider",
        "memory",
        "--storage-config",
        "{}",
        "--replace",
        "--yes",
      ]),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("persistent storage");
        return true;
      }
    );
    expect(
      await readFile(
        nodePath.join(cwd, "chatjs/providers/gateway-defaults.ts"),
        "utf-8"
      )
    ).toBe(beforeGateway);
    await run(nodePath.join(cwd, "electron"), [
      "bun",
      "install",
      "--ignore-scripts",
    ]);
    // Native source imports generated branding; prepare it before linting the companion.
    await run(nodePath.join(cwd, "electron"), ["bun", "run", "prebuild"]);
    await run(cwd, ["bun", "run", "lint"]);
  }
};

const verifyOptionalToolFiles = async (
  cwd: string,
  gateway: string
): Promise<void> => {
  expect(
    await Bun.file(
      nodePath.join(cwd, "tools/platform/generate-image.ts")
    ).exists()
  ).toBe(false);
  expect(
    await Bun.file(
      nodePath.join(cwd, "components/part/generate-image.tsx")
    ).exists()
  ).toBe(false);
  if (gateway !== "vercel") {
    expect(
      await Bun.file(
        nodePath.join(cwd, "chatjs/tools/generate-image/tool.ts")
      ).exists()
    ).toBe(false);
    expect(
      await readFile(nodePath.join(cwd, "chatjs/generated/ui.ts"), "utf-8")
    ).not.toContain("generate-image/renderer");
  }
  expect(
    await Bun.file(
      nodePath.join(cwd, "tests/eve-sandbox-lifecycle.e2e.ts")
    ).exists()
  ).toBe(false);
  expect(
    await Bun.file(
      nodePath.join(cwd, "tools/platform/generate-video.ts")
    ).exists()
  ).toBe(false);
  expect(
    await Bun.file(
      nodePath.join(cwd, "components/part/generate-video.tsx")
    ).exists()
  ).toBe(false);
  expect(
    await Bun.file(
      nodePath.join(cwd, "chatjs/tools/generate-video/tool.ts")
    ).exists()
  ).toBe(gateway === "vercel");
  expect(
    await readFile(nodePath.join(cwd, "chat.config.ts"), "utf-8")
  ).not.toMatch(/(?:image|video):\s*\{[^}]*\benabled:/u);
};

for (const gateway of [...GATEWAYS, "acme"]) {
  const electronFlag = gateway === "vercel" ? "--electron" : "--no-electron";
  it(`${gateway}: independently installed ChatJS app typechecks and loads the registry adapter`, async () => {
    const cwd = nodePath.join(root, gateway);
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
    await verifyGatewayInstallation(cwd, gateway);
    if (gateway === "openrouter") {
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/generated/installed-tools.ts"),
          "utf-8"
        )
      ).toContain("new Set([])");
      expect(
        await readFile(nodePath.join(cwd, ".env.example"), "utf-8")
      ).not.toMatch(
        /^(?:TAVILY_API_KEY|FIRECRAWL_API_KEY|MCP_ENCRYPTION_KEY|BLOB_READ_WRITE_TOKEN)=/mu
      );
    }

    await verifyOptionalToolFiles(cwd, gateway);
    const manifestPath = nodePath.join(cwd, "package.json");
    const manifest = parsePackageJson(await readFile(manifestPath, "utf-8"));
    const dependencies = requireJsonObject(
      manifest.dependencies,
      "dependencies"
    );
    if (gateway === "vercel") {
      expect(dependencies["@vercel/sandbox"]).toBeUndefined();
      expect(
        await Bun.file(
          nodePath.join(cwd, "chatjs/tools/generate-image/tool.ts")
        ).exists()
      ).toBe(true);
      expect(
        await readFile(nodePath.join(cwd, "chatjs/generated/ui.ts"), "utf-8")
      ).toContain("generate-image/renderer");
    }

    let selectedSdk = "@ai-sdk/openai-compatible";
    if (gateway !== "acme") {
      const selectedMetadata = Object.entries(gatewayMetadata).find(
        ([id]: readonly [
          string,
          (typeof gatewayMetadata)[keyof typeof gatewayMetadata],
        ]) => id === gateway
      );
      if (!selectedMetadata) {
        expect.unreachable(`Missing metadata for gateway ${gateway}`);
      }
      selectedSdk = selectedMetadata[1].dependency;
    }
    expect(selectedSdk).toBeDefined();
    for (const { dependency } of Object.values(gatewayMetadata)) {
      if (dependency !== selectedSdk) {
        expect(dependencies[dependency]).toBeUndefined();
      }
    }
    expect(dependencies["@chat-js/gateways"]).toBeUndefined();
    expect(
      await Bun.file(
        nodePath.join(cwd, "node_modules/@chat-js/gateways/package.json")
      ).exists()
    ).toBe(false);
    expect(
      await Bun.file(
        nodePath.join(cwd, "chatjs/core/gateway/runtime.ts")
      ).exists()
    ).toBe(true);

    if (gateway === "acme") {
      expect(dependencies["@vercel/sandbox"]).toBeUndefined();
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/tools/acme-video/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_VIDEO_KEY");
      expect(
        await readFile(nodePath.join(cwd, "chatjs/generated/ui.ts"), "utf-8")
      ).not.toContain("tool-generateVideo");
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/tools/acme-image/chatjs.json"),
          "utf-8"
        )
      ).toContain("ACME_IMAGE_KEY");
      await writeFile(
        nodePath.join(cwd, "verify-execution.ts"),
        `import assert from "node:assert/strict";
import {tools} from "./integrations/tools/execution";
import type { ToolContext } from "eve/tools";
const unavailable = () => { throw new Error("Unexpected resource access"); };
const context: ToolContext = { callId: "fixture", toolName: "fixture", messages: [], abortSignal: new AbortController().signal, session: { id: "fixture", auth: { current: null, initiator: null }, turn: { id: "turn", sequence: 0 } }, getSandbox: unavailable, getToken: unavailable, requireAuth: unavailable, to: unavailable, channel: { kind: "http", metadata: {} } };
assert.ok(tools.generateVideo.execute);
assert.deepEqual(await tools.generateVideo.execute({subject: "ocean"}, context), {asset: "ocean"});
assert.ok(tools.generateImage.execute);
assert.deepEqual(await tools.generateImage.execute({subject: "mountains"}, context), {asset: "mountains"});
`
      );
      await run(cwd, ["env", "PLAYWRIGHT=True", "bun", "verify-execution.ts"]);
      expect(dependencies["@vercel/blob"]).toBeUndefined();
      expect(dependencies["@aws-sdk/client-s3"]).toBeUndefined();
      await writeFile(
        nodePath.join(cwd, "verify-storage.ts"),
        `import { Files } from "files-sdk";
import { createStorageAdapter } from "./chatjs/providers/storage";
import { storageOptions, storageId, storageEnvRequirements } from "./chatjs/providers/storage-options";
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
      expect(dependencies["@aws-sdk/client-s3"]).toBeDefined();
      expect(dependencies["@vercel/blob"]).toBeUndefined();
    }

    const other = gateway === "vercel" ? "openai" : "vercel";
    await writeFile(
      nodePath.join(cwd, "gateway-type-check.ts"),
      `import { defineConfig } from "./lib/config-schema";
import { getActiveGateway } from "./lib/ai/active-gateway";
// Live provider catalogs may expose IDs newer than the SDK literal suggestions.
getActiveGateway().createLanguageModel("new/model-from-live-catalog");
getActiveGateway().createImageModel?.("new/image-from-live-catalog");
getActiveGateway().createVideoModel?.("new/video-from-live-catalog");
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
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "attach-workspace-file",
        "--yes",
      ]);
      const index = await readFile(
        nodePath.join(cwd, "chatjs/generated/tools.ts"),
        "utf-8"
      );
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "attach-workspace-file",
        "--yes",
      ]);
      expect(
        await readFile(nodePath.join(cwd, "chatjs/generated/tools.ts"), "utf-8")
      ).toBe(index);
      await run(cwd, [
        "bunx",
        "--bun",
        "shadcn@4.21.0",
        "add",
        "@chatjs/deep-research",
        "--yes",
      ]);
      await run(cwd, ["node", cliEntry, "sync"]);
      expect(
        await Bun.file(
          nodePath.join(cwd, "agent/tools/deepResearch.ts")
        ).exists()
      ).toBe(true);
      expect(
        await Bun.file(
          nodePath.join(cwd, "agent/lib/research/configuration.ts")
        ).exists()
      ).toBe(true);
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/generated/installed-tools.ts"),
          "utf-8"
        )
      ).toContain("deepResearch");
      expect(
        await readFile(nodePath.join(cwd, "chatjs/generated/ui.ts"), "utf-8")
      ).toContain('from "@/chatjs/tools/deep-research/renderer"');
    }
    await run(cwd, ["bun", "run", "test:types"]);
    await writeFile(
      nodePath.join(cwd, "probe.ts"),
      `import { Gateway } from "./chatjs/providers/gateway";
import assert from "node:assert/strict";
assert.equal(new Gateway().type, "${gateway}");
assert.equal(new Gateway().createVideoModel === null, ${gateway !== "vercel"});
assert.equal(new Gateway().createImageModel === null, ${gateway === "openrouter"});
`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe.ts"]);

    if (gateway === "acme") {
      const registryPort = registryServer.port ?? 0;
      await writeFile(
        nodePath.join(cwd, "probe-generation.ts"),
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
      nodePath.join(cwd, "probe-config.ts"),
      `import { getProvider } from "files-sdk/providers";
import config from "./chat.config";
import { applyDefaults, aiConfigSchema } from "./lib/config-schema";
import assert from "node:assert/strict";
assert.ok(getProvider("vercel-blob"));
assert.equal(applyDefaults(config).ai.gateway, "${gateway}");
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, tools: { ...applyDefaults(config).ai.tools, image: {} } }).success, ${gateway === "vercel"});
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, gateway: "${other}" }).success, false);
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, workflows: { ...applyDefaults(config).ai.workflows, chat: "" } }).success, false);
assert.equal(aiConfigSchema.safeParse({ ...applyDefaults(config).ai, tools: { ...applyDefaults(config).ai.tools, image: { default: "" } } }).success, false);
${
  gateway === "vercel"
    ? ""
    : `const ai = applyDefaults(config).ai;
assert.equal(aiConfigSchema.safeParse({ ...ai, tools: { ...ai.tools, video: {} } }).success, false);
assert.equal(aiConfigSchema.safeParse({ ...ai, tools: { ...ai.tools, video: { default: "unsupported" } } }).success, false);`
}

`
    );
    await run(cwd, ["bunx", "--no-install", "tsx", "probe-config.ts"]);
    if (gateway === "vercel") {
      await Promise.all(
        ["gateway-type-check.ts", "probe.ts", "probe-config.ts"].map(
          async (name) => {
            await rm(nodePath.join(cwd, name));
          }
        )
      );
      await run(cwd, ["bun", "run", "lint"]);
      // Reinstall the full selection while preserving user-authored registrations.
      expect(
        await Bun.file(
          nodePath.join(cwd, "app/(chat)/api/files/upload/route.ts")
        ).exists()
      ).toBe(true);
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "attachment-uploads",
        "mcp",
        "--yes",
      ]);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["node", cliEntry, "sync"]);
      expect(
        await Bun.file(
          nodePath.join(cwd, "app/(chat)/api/files/upload/route.ts")
        ).exists()
      ).toBe(true);
      expect(
        await readFile(nodePath.join(cwd, "agent/sandbox.ts"), "utf-8")
      ).toContain("VercelSandbox.environment()");
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["bun", "run", "lint"]);
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/generated/installed-uploads.ts"),
          "utf-8"
        )
      ).toContain("attachmentUploads");

      await rejects(
        run(cwd, [
          "node",
          cliEntry,
          "add",
          "--storage-provider",
          "s3",
          "--storage-config",
          '{"bucket":"replacement","region":"us-east-1"}',
          "--yes",
        ]),
        (reason: unknown) => {
          expect(() => {
            throw reason;
          }).toThrow("--replace");
          return true;
        }
      );
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
        nodePath.join(cwd, "chatjs/providers/storage-options.ts"),
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
      expect(
        await readFile(
          nodePath.join(cwd, "chatjs/providers/storage-options.ts"),
          "utf-8"
        )
      ).toBe(storageOptions);
      await run(cwd, ["bun", "run", "format"]);
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["bun", "run", "lint"]);
      const longDirectory = nodePath.join(cwd, "chatjs/tools/long-renderer");
      await mkdir(longDirectory);
      const toolExport =
        "attachWorkspaceFileWithAnIntentionallyLongNameForFormattingVerification";
      const rendererExport =
        "AttachWorkspaceFileRendererWithAnIntentionallyLongNameForFormattingVerification";
      await writeFile(
        nodePath.join(longDirectory, "tool.ts"),
        `export { attach_workspace_file as ${toolExport} } from "../attach-workspace-file/tool";\n`
      );
      await writeFile(
        nodePath.join(longDirectory, "renderer.tsx"),
        `export { AttachWorkspaceFileRenderer as ${rendererExport} } from "../attach-workspace-file/renderer";\n`
      );
      await writeFile(
        nodePath.join(longDirectory, "chatjs.json"),
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
        nodePath.join(cwd, "lib/ai/gateways/openrouter-gateway.ts")
      ).exists()
    ).toBe(false);
  }, 180_000);
}

it("native tools: a minimal scaffold installs external EVE tools and preserves durable usage", async () => {
  const cwd = nodePath.join(root, "native");
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
  await run(cwd, [
    "node",
    cliEntry,
    "add",
    `http://127.0.0.1:${registryServer.port}/paid-counter.json`,
    "--yes",
  ]);
  const manifest = parsePackageJson(
    await readFile(nodePath.join(cwd, "package.json"), "utf-8")
  );
  const dependencies = requireJsonObject(manifest.dependencies, "dependencies");
  expect(dependencies["@vercel/sandbox"]).toBeUndefined();
  expect(dependencies["@tavily/core"]).toBeUndefined();
  expect(dependencies["@mendable/firecrawl-js"]).toBeUndefined();
  await run(cwd, ["bun", "run", "test:types"]);
  await verifyNativeToolRuntime(cwd);
}, 240_000);

for (const installAtCreation of [false, true]) {
  it(`MCP: create ${installAtCreation ? "with" : "without"} MCP and add preserve core, UI order and setup errors`, async () => {
    const name = `mcp-${installAtCreation ? "installed" : "omitted"}`;
    const cwd = nodePath.join(root, name);
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
        ? ["--attachments", "--sandbox-provider", "vercel"]
        : []),
    ]);
    await Promise.all(
      ["app/(chat)/api/files/upload/route.ts"].map(async (file) => {
        expect(await Bun.file(nodePath.join(cwd, file)).exists()).toBe(
          installAtCreation
        );
      })
    );
    const source = "app/api/mcp/oauth/callback/route.ts";
    expect(await Bun.file(nodePath.join(cwd, source)).exists()).toBe(
      installAtCreation
    );
    expect(
      await readFile(nodePath.join(cwd, "lib/db/schema.ts"), "utf-8")
    ).not.toContain('"McpConnector"');
    expect(
      await Bun.file(
        nodePath.join(cwd, "chatjs/plugins/mcp/db/mcp-schema.ts")
      ).exists()
    ).toBe(installAtCreation);
    expect(
      await Bun.file(
        nodePath.join(cwd, "components/eve/eve-mcp-result.tsx")
      ).exists()
    ).toBe(true);
    expect(
      await readFile(nodePath.join(cwd, "chat.config.ts"), "utf-8")
    ).not.toMatch(/\bmcp:/u);
    if (!installAtCreation) {
      await run(cwd, ["bun", "run", "test:types"]);
      await run(cwd, ["node", cliEntry, "add", "mcp", "--yes"]);
    }
    expect(await Bun.file(nodePath.join(cwd, source)).exists()).toBe(true);
    expect(
      await readFile(
        nodePath.join(cwd, "chatjs/plugins/mcp/db/mcp-schema.ts"),
        "utf-8"
      )
    ).toContain('"McpConnector"');
    expect(
      await readFile(
        nodePath.join(cwd, "chatjs/generated/installed-database.ts"),
        "utf-8"
      )
    ).toContain("chatjs/plugins/mcp/db/mcp-schema.ts");
    expect(
      await readFile(
        nodePath.join(cwd, "chatjs/generated/installed-routers.ts"),
        "utf-8"
      )
    ).toContain(
      'import { router as mcpRouter } from "@/chatjs/plugins/mcp/router"'
    );
    const composer = await readFile(
      nodePath.join(cwd, "composer-controls.ts"),
      "utf-8"
    );
    const settings = await readFile(
      nodePath.join(cwd, "components/settings/settings-nav.tsx"),
      "utf-8"
    );
    await run(cwd, ["node", cliEntry, "sync"]);
    expect(
      await readFile(nodePath.join(cwd, "composer-controls.ts"), "utf-8")
    ).toBe(composer);
    expect(
      await readFile(
        nodePath.join(cwd, "components/settings/settings-nav.tsx"),
        "utf-8"
      )
    ).toBe(settings);
    await run(cwd, ["bun", "run", "test:types"]);
    await writeFile(
      nodePath.join(cwd, "mcp-setup-probe.ts"),
      `import assert from "node:assert/strict";
import descriptor from "./chatjs/plugins/mcp/chatjs.json";
import { requireCredentials } from "./lib/required-credentials";
assert.throws(() => requireCredentials("mcp", descriptor.envRequirements, {NODE_ENV: "test"}), /Missing credentials for mcp: MCP_ENCRYPTION_KEY/);
requireCredentials("mcp", descriptor.envRequirements, {NODE_ENV: "test", MCP_ENCRYPTION_KEY: "test"});
`
    );
    await run(cwd, ["bun", "mcp-setup-probe.ts"]);
    if (!installAtCreation) {
      const previousConfig = `${await readFile(nodePath.join(cwd, "chat.config.ts"), "utf-8")}\n// User model configuration remains editable.\n`;
      await writeFile(nodePath.join(cwd, "chat.config.ts"), previousConfig);
      const gatewayCore = nodePath.join(cwd, "chatjs/core/gateway/runtime.ts");
      const editedCore = `${await readFile(gatewayCore, "utf-8")}\n// Local gateway runtime customization.\n`;
      await writeFile(gatewayCore, editedCore);
      const catalog = nodePath.join(cwd, "lib/ai/models.generated.ts");
      await writeFile(
        catalog,
        `${await readFile(catalog, "utf-8")}\n// Refreshed model catalog.\n`
      );

      await rejects(
        run(cwd, [
          "node",
          cliEntry,
          "add",
          "--gateway",
          "openai-compatible",
          "--yes",
        ]),
        (reason: unknown) => {
          expect(() => {
            throw reason;
          }).toThrow("--replace");
          return true;
        }
      );
      await run(cwd, [
        "node",
        cliEntry,
        "add",
        "--gateway",
        "openai-compatible",
        "--replace",
        "--yes",
      ]);
      expect(await readFile(gatewayCore, "utf-8")).toBe(editedCore);
      const switchedManifest = parsePackageJson(
        await readFile(nodePath.join(cwd, "package.json"), "utf-8")
      );
      expect(
        switchedManifest.dependencies?.["@chat-js/gateways"]
      ).toBeUndefined();
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
        await readFile(
          nodePath.join(cwd, "chatjs/providers/storage-options.ts"),
          "utf-8"
        )
      ).toContain("after-gateway");
      const nextConfig = await readFile(
        nodePath.join(cwd, "chat.config.ts"),
        "utf-8"
      );
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
    const computedSettings = settings.replace(
      "<nav",
      '<nav aria-label="Application settings"'
    );
    await writeFile(
      nodePath.join(cwd, "composer-controls.ts"),
      computedComposer
    );
    await writeFile(
      nodePath.join(cwd, "components/settings/settings-nav.tsx"),
      computedSettings
    );
    await run(cwd, ["node", cliEntry, "add", "deep-research", "--yes"]);
    expect(
      await readFile(nodePath.join(cwd, "composer-controls.ts"), "utf-8")
    ).toBe(computedComposer);
    expect(
      await readFile(
        nodePath.join(cwd, "components/settings/settings-nav.tsx"),
        "utf-8"
      )
    ).toBe(computedSettings);
  }, 180_000);
}

const NATIVE_SANDBOX_INSTALL_TEST_TIMEOUT_MS = 180_000;
it(
  "Docker installs and replaces Vercel through the packed CLI",
  async () => {
    const cwd = nodePath.join(root, "docker");
    await run(root, [
      "node",
      cliEntry,
      "create",
      "docker",
      "--yes",
      "--no-electron",
      "--gateway",
      "openai",
      "--sandbox-provider",
      "docker",
    ]);
    const appManifest = parsePackageJson(
      await readFile(nodePath.join(cwd, "package.json"), "utf-8")
    );
    expect(appManifest.scripts?.["dev:supervise"]).toContain(
      "scripts/dev-supervisor.mts"
    );
    await run(cwd, [
      "node",
      "--import=tsx",
      "--input-type=module",
      "-e",
      `
      import { supervise } from "./scripts/dev-supervisor.mts";
      if (typeof supervise !== "function") throw new Error("Invalid standalone supervisor");
    `,
    ]);
    await rejects(
      run(cwd, [
        "env",
        "APP_URL=https://example.invalid",
        "node",
        "--import=tsx",
        "scripts/dev-supervisor.mts",
      ]),
      /local app URL/u
    );
    expect(
      await readFile(nodePath.join(cwd, "agent/sandbox.ts"), "utf-8")
    ).toContain("DockerSandbox.environment");
    await run(cwd, ["bun", "run", "test:types"]);
    await run(cwd, [
      "node",
      cliEntry,
      "add",
      "--sandbox-provider",
      "vercel",
      "--replace",
      "--yes",
    ]);
    expect(
      await readFile(nodePath.join(cwd, "agent/sandbox.ts"), "utf-8")
    ).toContain("VercelSandbox.environment");
    await run(cwd, ["bun", "run", "test:types"]);
    await run(cwd, [
      "node",
      cliEntry,
      "add",
      "--sandbox-provider",
      "docker",
      "--replace",
      "--yes",
    ]);
    expect(
      await readFile(nodePath.join(cwd, ".env.example"), "utf-8")
    ).not.toContain("VERCEL_TOKEN");
    expect(
      await Bun.file(
        nodePath.join(cwd, "chatjs/providers/sandbox/persistent.ts")
      ).exists()
    ).toBe(false);
    await run(cwd, ["bun", "run", "test:types"]);
    await run(cwd, ["bun", "run", "lint"]);
  },
  NATIVE_SANDBOX_INSTALL_TEST_TIMEOUT_MS
);

testChatPluginSelections(root, cliEntry);

testFullInstallation(root, cliEntry);
