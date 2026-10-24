import { z } from "zod";

import { preflight } from "./preflight";

import { readProviderId, readProviderLiteral } from "./provider-config";

type MediaKind = "image" | "video";
interface MediaGateway {
  readonly capabilities: Readonly<Record<MediaKind, boolean>>;
  readonly defaults: {
    readonly roles: Readonly<Partial<Record<MediaKind, string>>>;
  };
}
interface StorageConsumer {
  readonly id: string;
  readonly requiresStorage?: true;
}
interface MediaConsumer extends StorageConsumer {
  readonly requiresGateway?: readonly MediaKind[];
  readonly requiresSandbox?: true;
}

const capabilitiesSchema = z.object({ image: z.boolean(), video: z.boolean() });
const mediaDefaultsSchema = z.object({
  roles: z.object({
    image: z.string().optional(),
    video: z.string().optional(),
  }),
});
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
      `${consumers.map((item) => item.id).join(", ")} requires persistent storage. Select --storage-provider before installing file-backed plugins.`
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
      const model = gateway.defaults.roles[kind];
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

class SandboxRequiredError extends Error {
  constructor() {
    super(
      "This tool requires sandbox infrastructure. Select --sandbox-provider vercel or daytona."
    );
    this.name = "SandboxRequiredError";
  }
}

const validateProviderRequirements = async (
  cwd: string,
  target: {
    readonly gateway?: MediaGateway;
    readonly storage?: string;
    readonly sandbox?: string;
    readonly tools: readonly MediaConsumer[];
    readonly plugins: readonly StorageConsumer[];
  }
): Promise<void> => {
  if (target.tools.some((tool) => tool.requiresSandbox)) {
    const sandbox = target.sandbox ?? (await readProviderId(cwd, "sandbox"));
    if (typeof sandbox !== "string" || sandbox === "") {
      throw new SandboxRequiredError();
    }
  }
  const fileConsumers = [...target.tools, ...target.plugins].filter((item) =>
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

export {
  SandboxRequiredError,
  registryMetadataKind,
  validateRequestedKind,
  validateProviderRequirements,
  validateCodeExecutionRequirements,
};
