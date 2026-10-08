import { z } from "zod";

/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places zod (z) before ./preflight (preflight); sort-imports requires the reverse. */
import { preflight } from "./preflight";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places ./preflight (preflight, single) before ./provider-config (readProviderId, multiple); sort-imports requires the reverse. */
import { readProviderId, readProviderLiteral } from "./provider-config";
/* oxlint-enable sort-imports */

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
  if (tool.id === "generate-video") {
    return ["video"];
  }
  return [];
};

const requiresStorage = (item: StorageConsumer): boolean =>
  item.requiresStorage === true ||
  ["generate-image", "generate-video", "attachment-uploads"].includes(item.id);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateStorage's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installedMediaGateway's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateProviderRequirements's awaited sequencing and rejected-Promise behavior. */
const validateProviderRequirements = async (
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
/* oxlint-enable oxc/no-async-await */
const validateCodeExecutionRequirements = (
  definition: Readonly<{
    slot?: string;
    codeExecutorExport?: string;
    codeExecutionCapabilities?: unknown;
  }>
): void => {
  if (
    definition.slot === "codeExecution" &&
    ((definition.codeExecutorExport ?? "") === "" ||
      typeof definition.codeExecutionCapabilities !== "object" ||
      definition.codeExecutionCapabilities === null)
  ) {
    throw new Error(
      "Selected codeExecution provider requires a typed executor and declared execution, cleanup and usage capabilities."
    );
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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (registryMetadataKind, validateRequestedKind, validateProviderRequirements, validateCodeExecutionRequirements); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  registryMetadataKind,
  validateRequestedKind,
  validateProviderRequirements,
  validateCodeExecutionRequirements,
};
/* oxlint-enable import/no-named-export */
