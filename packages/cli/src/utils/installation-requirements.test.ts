import { afterEach, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:os (tmpdir) before node:path (path); sort-imports requires the reverse. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:path (path, single) before ../../../registry/metadata (featureDefinitionSchema, multiple); sort-imports requires the reverse. */
import {
  featureDefinitionSchema,
  toolDefinitionSchema,
  // oxlint-disable-next-line import/no-relative-parent-imports -- Use the existing package-local registry contract and test fixture in the standalone CLI layout.
} from "../../../registry/metadata";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-relative-parent-imports -- Use the existing package-local registry contract and test fixture in the standalone CLI layout.
import { externalGatewayFixture } from "../../test/external-gateway";
import { validateProviderRequirements } from "./installation-requirements";

const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
afterEach(async () => {
  await Promise.all(
    // oxlint-disable-next-line eslint/no-magic-numbers -- These local values specify JSON indentation, source offsets or bounded test fixtures.
    roots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
/* oxlint-enable oxc/no-async-await */
const media = (
  kind: "image" | "video"
): ReturnType<typeof toolDefinitionSchema.parse> =>
  toolDefinitionSchema.parse({
    contractVersion: 1,
    id: `generate-${kind}`,
    kind: "tool",
    requiresGateway: [kind],
    requiresStorage: true,
    tools: [{ toolExport: "generateMedia" }],
  });

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("legacy built-in descriptors retain mandatory media and storage requirements", async () => {
  const gateway = externalGatewayFixture().root.meta.chatjs;
  const video = media("video");
  delete video.requiresGateway;
  delete video.requiresStorage;
  gateway.capabilities.video = false;
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await Bun's asynchronous rejection matcher before advancing the fixture.
  await expect(
    validateProviderRequirements(tmpdir(), {
      features: [],
      gateway,
      storage: "s3",
      tools: [video],
    })
  ).rejects.toThrow("supporting video");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await Bun's asynchronous rejection matcher before advancing the fixture.
  await expect(
    validateProviderRequirements(tmpdir(), {
      features: [],
      gateway,
      storage: "memory",
      tools: [video],
    })
  ).rejects.toThrow("persistent storage");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await Bun's asynchronous rejection matcher before advancing the fixture.
  await expect(
    validateProviderRequirements(tmpdir(), {
      features: [{ id: "attachment-uploads" }],
      storage: "memory",
      tools: [],
    })
  ).rejects.toThrow("persistent storage");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["image", "video"] as const)'s awaited sequencing and rejected-Promise behavior. */
test.each(["image", "video"] as const)(
  "rejects %s without gateway capability or model, including external gateways",
  async (kind) => {
    const gateway = externalGatewayFixture().root.meta.chatjs;
    const target = {
      features: [],
      gateway,
      storage: "s3",
      tools: [media(kind)],
    };
    gateway.capabilities[kind] = false;
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
    await expect(
      validateProviderRequirements(tmpdir(), target)
    ).rejects.toThrow(`supporting ${kind}`);
    gateway.capabilities[kind] = true;
    gateway.defaults.tools[kind] = {};
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
    await expect(
      validateProviderRequirements(tmpdir(), target)
    ).rejects.toThrow("default model");
    gateway.defaults.tools[kind] = { default: "model" };
    await validateProviderRequirements(tmpdir(), target);
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("uploads and media reject memory storage, while a minimal installation accepts it", async () => {
  const uploads = featureDefinitionSchema.parse({
    contractVersion: 1,
    id: "attachment-uploads",
    kind: "feature",
    requiresStorage: true,
  });
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
  await expect(
    validateProviderRequirements(tmpdir(), {
      features: [uploads],
      storage: "memory",
      tools: [],
    })
  ).rejects.toThrow("requires persistent storage");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
  await expect(
    validateProviderRequirements(tmpdir(), {
      features: [],
      storage: "memory",
      tools: [media("image")],
    })
  ).rejects.toThrow("requires persistent storage");
  await validateProviderRequirements(tmpdir(), {
    features: [],
    storage: "memory",
    tools: [],
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/max-statements -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit.
test("add validates installed provider literals without executing user source", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-requirements-"));
  roots.push(cwd);
  await mkdir(path.join(cwd, "lib/ai"), { recursive: true });
  await writeFile(
    path.join(cwd, "lib/storage-options.ts"),
    'const storageId = "s3";'
  );
  const file = path.join(cwd, "lib/ai/gateway-model-defaults.ts");
  const source = `throw new Error("must not execute");
    const gatewayCapabilities = { image: true, video: false };
    const gatewayModelDefaults = { tools: { image: { default: "image-model" }, video: {} } } satisfies UnknownType;`;
  await writeFile(file, source);
  await validateProviderRequirements(cwd, {
    features: [],
    tools: [media("image")],
  });
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
  await expect(
    validateProviderRequirements(cwd, { features: [], tools: [media("video")] })
  ).rejects.toThrow("supporting video");
  await writeFile(
    file,
    source.replace("image: true", "image: computeCapability()")
  );
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous Bun rejection matcher even though its declaration returns void.
  await expect(
    validateProviderRequirements(cwd, { features: [], tools: [media("image")] })
  ).rejects.toThrow("literal values");
});
/* oxlint-enable oxc/no-async-await */
