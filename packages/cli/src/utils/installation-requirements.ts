import { z } from "zod";

import { preflight } from "./preflight";

import { readProviderId, readProviderLiteral } from "./provider-config";

import {
  supportsMedia,
  supportsNativeProcesses,
  hasPersistentStorage,
} from "../../../registry/provider-capabilities";
import type {
  MediaGateway,
  MediaKind,
} from "../../../registry/provider-capabilities";

interface StorageConsumer {
  readonly id: string;
  readonly requiresStorage?: true;
}
interface MediaConsumer extends StorageConsumer {
  readonly requiresGateway?: readonly MediaKind[];
  readonly requiresNativeProcesses?: true;
}

const capabilitiesSchema = z.object({ image: z.boolean(), video: z.boolean() });
const mediaDefaultsSchema = z.object({
  roles: z.object({
    image: z.string().optional(),
    video: z.string().optional(),
  }),
});
const noConsumers = 0;

const validateStorage = async (
  cwd: string,
  consumers: readonly StorageConsumer[],
  selected?: string
): Promise<void> => {
  if (consumers.length === noConsumers) {
    return;
  }
  if (typeof selected !== "string") {
    await preflight(cwd, ["chatjs/providers/storage-options.ts"]);
  }
  const storage = selected ?? (await readProviderId(cwd, "storage"));
  if (!hasPersistentStorage(storage)) {
    throw new Error(
      `${consumers.map((item) => item.id).join(", ")} requires persistent storage. Select --storage-provider before installing file-backed plugins.`
    );
  }
};
const installedMediaGateway = async (cwd: string): Promise<MediaGateway> => {
  const file = "chatjs/providers/gateway-defaults.ts";
  await preflight(cwd, [file]);
  const capabilities = await readProviderLiteral(
    cwd,
    file,
    "gatewayCapabilities"
  );
  const defaults = await readProviderLiteral(cwd, file, "gatewayModelDefaults");
  return {
    capabilities: capabilitiesSchema.parse(capabilities),
    defaults: mediaDefaultsSchema.parse(defaults),
  };
};
const validateMedia = (
  tools: readonly MediaConsumer[],
  gateway: MediaGateway
): void => {
  for (const tool of tools) {
    for (const kind of tool.requiresGateway ?? []) {
      if (!supportsMedia(gateway, kind)) {
        throw new Error(
          `${tool.id} requires a gateway supporting ${kind} generation with a nonempty default model. Select a compatible gateway or omit this tool.`
        );
      }
    }
  }
};

const validateProviderRequirements = async (
  cwd: string,
  target: {
    readonly gateway?: MediaGateway;
    readonly storage?: string;
    readonly sandboxRuntimes?: readonly string[];
    readonly tools: readonly MediaConsumer[];
    readonly plugins: readonly StorageConsumer[];
  }
): Promise<void> => {
  const fileConsumers = [...target.tools, ...target.plugins].filter(
    (item) => item.requiresStorage === true
  );
  await validateStorage(cwd, fileConsumers, target.storage);
  if (target.tools.some((tool) => tool.requiresNativeProcesses)) {
    const supportsNative =
      target.sandboxRuntimes === undefined
        ? (await readProviderId(cwd, "sandbox")) !== "just-bash"
        : supportsNativeProcesses(target.sandboxRuntimes);
    if (!supportsNative) {
      throw new Error(
        "Code execution requires native Python and Node processes. Select Automatic, Vercel Sandbox or Docker."
      );
    }
  }
  const mediaConsumers = target.tools.filter(
    (item) => (item.requiresGateway?.length ?? noConsumers) > noConsumers
  );
  if (mediaConsumers.length > noConsumers) {
    const gateway = target.gateway ?? (await installedMediaGateway(cwd));
    validateMedia(mediaConsumers, gateway);
  }
};

const registryMetadataKind = (metadata: unknown): unknown =>
  typeof metadata === "object" &&
  metadata !== null &&
  "kind" in metadata &&
  metadata.kind;

const validateRequestedKind = (
  source: string,
  kind: string | undefined,
  actual: unknown
): void => {
  if (typeof kind === "string" && kind !== "" && kind !== actual) {
    throw new Error(
      `Selected ${kind} item has incompatible ChatJS metadata: ${source}`
    );
  }
};

export {
  registryMetadataKind,
  validateRequestedKind,
  validateProviderRequirements,
};
