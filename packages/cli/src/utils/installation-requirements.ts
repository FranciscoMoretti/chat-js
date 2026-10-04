import { z } from "zod";

import { preflight } from "./preflight";
import { readProviderId, readProviderLiteral } from "./provider-config";

type MediaKind = "image" | "video";
interface MediaGateway {
  readonly capabilities: Readonly<Record<MediaKind, boolean>>;
  readonly defaults: {
    readonly tools: Readonly<Record<MediaKind, { readonly default?: string }>>;
  };
}
interface StorageConsumer {
  readonly id: string;
  readonly requiresStorage?: true;
}
interface MediaConsumer extends StorageConsumer {
  readonly requiresGateway?: readonly MediaKind[];
}

const capabilitiesSchema = z.object({ image: z.boolean(), video: z.boolean() });
const mediaSchema = z.object({ default: z.string().optional() });
const toolsSchema = z.object({ image: mediaSchema, video: mediaSchema });
const mediaDefaultsSchema = z.object({ tools: toolsSchema });
const noConsumers = 0;

// These built-in IDs predate declarative requirements in installed descriptors.
const requiredMedia = (tool: MediaConsumer): readonly MediaKind[] => {
  if (tool.requiresGateway) {
    return tool.requiresGateway;
  }
  if (tool.id === "generate-image") {
    return ["image"];
  }
  return tool.id === "generate-video" ? ["video"] : [];
};

const requiresStorage = (item: StorageConsumer): boolean =>
  item.requiresStorage === true ||
  ["generate-image", "generate-video", "attachment-uploads"].includes(item.id);

const validateStorage = async (
  cwd: string,
  consumers: readonly StorageConsumer[],
  selected?: string
): Promise<void> => {
  if (consumers.length === noConsumers) {
    return;
  }
  if (typeof selected !== "string") {
    await preflight(cwd, ["lib/storage-options.ts"]);
  }
  const storage = selected ?? (await readProviderId(cwd, "storage"));
  if (typeof storage !== "string" || storage === "" || storage === "memory") {
    throw new Error(
      `${consumers.map((item) => item.id).join(", ")} requires persistent storage. Select --storage-provider before installing file-backed features.`
    );
  }
};

const installedMediaGateway = async (cwd: string): Promise<MediaGateway> => {
  const file = "lib/ai/gateway-model-defaults.ts";
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
    for (const kind of requiredMedia(tool)) {
      const model = gateway.defaults.tools[kind].default;
      if (
        !gateway.capabilities[kind] ||
        typeof model !== "string" ||
        model.trim() === ""
      ) {
        throw new Error(
          `${tool.id} requires a gateway supporting ${kind} generation with a nonempty default model. Select a compatible gateway or omit this tool.`
        );
      }
    }
  }
};

export const validateProviderRequirements = async (
  cwd: string,
  target: {
    readonly gateway?: MediaGateway;
    readonly storage?: string;
    readonly tools: readonly MediaConsumer[];
    readonly features: readonly StorageConsumer[];
  }
): Promise<void> => {
  const fileConsumers = [...target.tools, ...target.features].filter((item) =>
    requiresStorage(item)
  );
  await validateStorage(cwd, fileConsumers, target.storage);
  const mediaConsumers = target.tools.filter(
    (item) => requiredMedia(item).length > noConsumers
  );
  if (mediaConsumers.length > noConsumers) {
    const gateway = target.gateway ?? (await installedMediaGateway(cwd));
    validateMedia(mediaConsumers, gateway);
  }
};
