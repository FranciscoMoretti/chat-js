import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import {
  pluginDefinitionSchema,
  toolDefinitionSchema,
} from "../../../registry/metadata";

import { externalGatewayFixture } from "../../test/external-gateway";
import { validateProviderRequirements } from "./installation-requirements";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
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

test("legacy built-in descriptors retain mandatory media and storage requirements", async () => {
  const gateway = externalGatewayFixture().root.meta.chatjs;
  const video = media("video");
  delete video.requiresGateway;
  delete video.requiresStorage;
  gateway.capabilities.video = false;

  await rejects(
    validateProviderRequirements(tmpdir(), {
      plugins: [],
      gateway,
      storage: "s3",
      tools: [video],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("supporting video");
      return true;
    }
  );

  await rejects(
    validateProviderRequirements(tmpdir(), {
      plugins: [],
      gateway,
      storage: "memory",
      tools: [video],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("persistent storage");
      return true;
    }
  );

  await rejects(
    validateProviderRequirements(tmpdir(), {
      plugins: [{ id: "attachment-uploads" }],
      storage: "memory",
      tools: [],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("persistent storage");
      return true;
    }
  );
});
test.each(["image", "video"] as const)(
  "rejects %s without gateway capability or model, including external gateways",
  async (kind) => {
    const gateway = externalGatewayFixture().root.meta.chatjs;
    const target = {
      plugins: [],
      gateway,
      storage: "s3",
      tools: [media(kind)],
    };
    gateway.capabilities[kind] = false;

    await rejects(
      validateProviderRequirements(tmpdir(), target),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow(`supporting ${kind}`);
        return true;
      }
    );
    gateway.capabilities[kind] = true;
    gateway.defaults.roles[kind] = undefined;

    await rejects(
      validateProviderRequirements(tmpdir(), target),
      (reason: unknown) => {
        expect(() => {
          throw reason;
        }).toThrow("default model");
        return true;
      }
    );
    gateway.defaults.roles[kind] = "model";
    await validateProviderRequirements(tmpdir(), target);
  }
);
test("uploads and media reject memory storage, while a minimal installation accepts it", async () => {
  const uploads = pluginDefinitionSchema.parse({
    contractVersion: 1,
    id: "attachment-uploads",
    kind: "plugin",
    requiresStorage: true,
  });

  await rejects(
    validateProviderRequirements(tmpdir(), {
      plugins: [uploads],
      storage: "memory",
      tools: [],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("requires persistent storage");
      return true;
    }
  );

  await rejects(
    validateProviderRequirements(tmpdir(), {
      plugins: [],
      storage: "memory",
      tools: [media("image")],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("requires persistent storage");
      return true;
    }
  );
  await validateProviderRequirements(tmpdir(), {
    plugins: [],
    storage: "memory",
    tools: [],
  });
});
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
    const gatewayModelDefaults = { roles: { image: "image-model" } } satisfies UnknownType;`;
  await writeFile(file, source);
  await validateProviderRequirements(cwd, {
    plugins: [],
    tools: [media("image")],
  });

  await rejects(
    validateProviderRequirements(cwd, {
      plugins: [],
      tools: [media("video")],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("supporting video");
      return true;
    }
  );
  await writeFile(
    file,
    source.replace("image: true", "image: computeCapability()")
  );

  await rejects(
    validateProviderRequirements(cwd, {
      plugins: [],
      tools: [media("image")],
    }),
    (reason: unknown) => {
      expect(() => {
        throw reason;
      }).toThrow("literal values");
      return true;
    }
  );
});

test("uploads reject absent and nonpersistent sandboxes, accept compatible external providers", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-upload-sandbox-"));
  roots.push(cwd);
  const target = {
    plugins: [{ id: "attachment-uploads" }],
    storage: "s3",
    tools: [],
  };
  await rejects(
    validateProviderRequirements(cwd, target),
    /persistent sandbox/u
  );
  await rejects(
    validateProviderRequirements(cwd, {
      ...target,
      sandbox: "daytona",
      sandboxProviderSource: "export const supportsPersistentSandbox = false;",
    }),
    /persistent sandbox/u
  );
  await validateProviderRequirements(cwd, {
    ...target,
    sandbox: "external",
    sandboxProviderSource:
      'throw new Error("must not execute"); export const supportsPersistentSandbox = true;',
  });
  await mkdir(path.join(cwd, "lib/sandbox"), { recursive: true });
  await writeFile(
    path.join(cwd, "lib/sandbox/options.ts"),
    'export const sandboxId = "external";'
  );
  await writeFile(
    path.join(cwd, "lib/sandbox/provider.ts"),
    "export const supportsPersistentSandbox = true;"
  );
  await validateProviderRequirements(cwd, target);
  // A replacement must satisfy existing uploads even when the old provider does.
  await rejects(
    validateProviderRequirements(cwd, {
      ...target,
      sandbox: "daytona",
      sandboxProviderSource: "export const supportsPersistentSandbox = false;",
    }),
    /persistent sandbox/u
  );
});
