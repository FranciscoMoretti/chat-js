import {
  AUTHENTICATION_DEFAULTS,
  FEATURES_DEFAULTS,
} from "../../../../apps/chat/lib/config-schema";
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  GATEWAYS,
} from "#cli/types";
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  Gateway,
} from "#cli/types";
import {
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
} from "./storage-provider";
import {
  authEnvRequirements,
  coreFeatureEnvRequirements,
  gatewayEnvRequirements,
} from "./config-requirements";
import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from "@clack/prompts";
import type { GatewayDefinition } from "../../../registry/src/gateways/definition";
import type { Option } from "@clack/prompts";
import { PROVIDER_NAMES } from "files-sdk/providers";
import type { ReadonlyInput } from "./readonly-input";
import type { RegistryIndexItem } from "#cli/registry/schema";
import type { StorageSelection } from "#cli/registry/storage";
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
import { highlighter } from "#cli/utils/highlighter";
import { resolveStorage } from "#cli/registry/storage";

const AUTH_DEFAULTS: Record<AuthProvider, boolean> = AUTHENTICATION_DEFAULTS;

const CORE_FEATURE_LABELS: Record<CoreFeatureKey, string> = {
  attachments: "Attachments",
  followupSuggestions: "Follow-up Suggestions",
  mcp: "MCP Tool Servers",
  projects: "Projects",
  feedback: "Message feedback",
  parallelResponses: "Parallel Responses",
};

const BUILT_IN_TOOL_LABELS: Record<BuiltInToolKey, string> = {
  deepResearch: "Deep Research",
  imageGeneration: "Image Generation",
  videoGeneration: "Video Generation",
};

const BUILT_IN_TOOL_HINTS: Record<BuiltInToolKey, string> = {
  deepResearch: "Run multi-step web research and generate reports",
  imageGeneration: "Generate images inside chat",
  videoGeneration: "Generate videos inside chat",
};

const BUILT_IN_TOOL_DEFAULTS: Readonly<Record<BuiltInToolKey, boolean>> = {
  deepResearch: false,
  imageGeneration: false,
  videoGeneration: false,
};

const AUTH_LABELS: Record<AuthProvider, string> = {
  github: "GitHub OAuth",
  google: "Google OAuth",
  vercel: "Vercel OAuth",
};

const PROMPT_CANCEL_EXIT_CODE = 1;

const handleCancel: <PromptValue>(
  value: PromptValue
) => asserts value is Exclude<PromptValue, symbol> = (value) => {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(PROMPT_CANCEL_EXIT_CODE);
  }
};

const toKebabCase = (value: string | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/gu, "-")
    .replaceAll(/-+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

const promptProjectName = async (
  targetArg: string | undefined,
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return toKebabCase(targetArg ?? "my-chat-app") || "my-chat-app";
  }

  const name = await text({
    initialValue: targetArg ?? "my-chat-app",
    message: "What is your project named?",
    validate: (value?: string) => {
      const kebab = toKebabCase(value);
      if (!kebab) {
        return "Please enter a valid project name";
      }
      return globalThis.undefined;
    },
  });
  handleCancel(name);

  return toKebabCase(name) || "my-chat-app";
};
const promptGateway = async (skipPrompt: boolean): Promise<Gateway> => {
  if (skipPrompt) {
    return "vercel";
  }

  const gateway = await select({
    initialValue: "vercel",
    message: `Which ${highlighter.info("AI gateway")} would you like to use?`,
    options: [
      ...GATEWAYS.map((gw) => ({
        hint: gatewayEnvRequirements[gw]
          .map(
            (requirement: Readonly<{ description: string }>) =>
              requirement.description
          )
          .join("; "),
        label: gw,
        value: gw,
      })),
      {
        hint: "URL or local JSON path",
        label: "External registry item",
        value: "__external__",
      },
    ],
  });
  handleCancel(gateway);
  if (gateway === "__external__") {
    const source = await text({
      message: "Gateway registry item URL or local JSON path:",
      validate: (value): "Enter a registry item address" | undefined => {
        if (typeof value !== "string" || value.trim() === "") {
          return "Enter a registry item address";
        }
        return undefined;
      },
    });
    handleCancel(source);
    return source.trim();
  }
  return gateway;
};
const APPEND_DELETE_COUNT = 0;
const EMPTY_CONFIG_KEY_COUNT = 0;

type StorageRequirementInput = ReadonlyInput<
  ReturnType<typeof getStorageEnvironmentRequirements>[number]
>;

const registryStorageRequirement = (
  requirement: StorageRequirementInput
): StorageSelection["definition"]["envRequirements"][number] => ({
  description: requirement.description,
  options: requirement.options.flatMap((option) => {
    let alternatives: string[][] = [[]];
    for (const variable of option) {
      alternatives = alternatives.flatMap((alternative: readonly string[]) =>
        [variable.key, ...variable.aliases].map((key) =>
          alternative.toSpliced(alternative.length, APPEND_DELETE_COUNT, key)
        )
      );
    }
    return alternatives;
  }),
});

const promptStorage = async (
  skipPrompt: boolean,
  explicitProvider?: string,
  explicitOptions?: string,
  cwd = process.cwd()
): Promise<StorageSelection> => {
  let source = explicitProvider ?? "vercel-blob";
  if (
    !(typeof explicitProvider === "string" && explicitProvider !== "") &&
    !skipPrompt
  ) {
    const choice = await select({
      initialValue: "vercel-blob",
      message: "Which file storage provider would you like to use?",
      options: [
        ...INSTALLABLE_STORAGE_PROVIDERS.map(
          (
            item: ReadonlyInput<(typeof INSTALLABLE_STORAGE_PROVIDERS)[number]>
          ) => ({
            label: item.title,
            value: item.meta.chatjs.id,
          })
        ),
        {
          hint: "Namespace, URL or local JSON path",
          label: "External registry item",
          value: "__external__",
        },
      ],
    });
    handleCancel(choice);
    source = choice;
    if (source === "__external__") {
      const address = await text({
        message: "Storage registry item address:",
        validate: (value): "Enter an item address" | undefined => {
          if (typeof value !== "string" || value.trim() === "") {
            return "Enter an item address";
          }
          return undefined;
        },
      });
      handleCancel(address);
      source = address.trim();
    }
  }
  const selection = await resolveStorage(source, cwd);
  const keys = selection.definition.configKeys;
  let options = explicitOptions;
  if (
    options === globalThis.undefined &&
    keys.length > EMPTY_CONFIG_KEY_COUNT
  ) {
    if (skipPrompt) {
      throw new Error(
        `Storage requires adapter options (${keys.join(", ")}). Pass --storage-config.`
      );
    }
    const input = await text({
      message: `Non-secret adapter options as JSON (${keys.join(", ")}). Credentials use environment variables.`,
      validate: (value) => {
        try {
          parseStorageOptions(value ?? "");
        } catch {
          return "Enter a JSON object";
        }
        return globalThis.undefined;
      },
    });
    handleCancel(input);
    options = input;
  }
  selection.options =
    options === globalThis.undefined ? {} : parseStorageOptions(options);
  // Only the actual built-in address uses SDK-derived option/credential rules.
  // An external item may use the same id with its own contract.
  const builtin = INSTALLABLE_STORAGE_PROVIDERS.find(
    (item: ReadonlyInput<(typeof INSTALLABLE_STORAGE_PROVIDERS)[number]>) =>
      selection.source === `@chatjs/${item.name}`
  );
  const providerId = PROVIDER_NAMES.find(
    (id) => id === (builtin && builtin.meta.chatjs.id)
  );
  if (providerId !== globalThis.undefined) {
    selection.definition.envRequirements = getStorageEnvironmentRequirements(
      providerId,
      selection.options
    ).map((requirement: StorageRequirementInput) =>
      registryStorageRequirement(requirement)
    );
  }
  return selection;
};

const promptCoreFeatures = async (
  skipPrompt: boolean,
  mcp?: boolean,
  projects?: boolean
): Promise<Record<CoreFeatureKey, boolean>> => {
  const CORE_FEATURE_DEFAULTS: Record<CoreFeatureKey, boolean> = {
    attachments: false,
    followupSuggestions: false,
    feedback: false,
    mcp: mcp ?? false,
    projects: projects ?? false,
    parallelResponses: FEATURES_DEFAULTS.parallelResponses,
  };

  if (skipPrompt) {
    return { ...CORE_FEATURE_DEFAULTS };
  }

  const availableFeatures = CORE_FEATURE_KEYS.filter(
    (key) =>
      (key !== "mcp" || mcp === globalThis.undefined) &&
      (key !== "projects" || projects === globalThis.undefined)
  );
  const selected = await multiselect({
    initialValues: availableFeatures.filter(
      (key) => CORE_FEATURE_DEFAULTS[key]
    ),
    message: `Which ${highlighter.info("core features")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: availableFeatures.map((key) => ({
      hint: coreFeatureEnvRequirements[key]
        ?.map(
          (requirement: Readonly<{ description: string }>) =>
            requirement.description
        )
        .join("; "),
      label: CORE_FEATURE_LABELS[key],
      value: key,
    })),
    required: false,
  });
  handleCancel(selected);

  return {
    attachments: selected.includes("attachments"),
    parallelResponses: selected.includes("parallelResponses"),
    mcp: mcp ?? selected.includes("mcp"),
    projects: projects ?? selected.includes("projects"),
    feedback: selected.includes("feedback"),
    followupSuggestions: selected.includes("followupSuggestions"),
  };
};
const isInstallableTool = (item: ReadonlyInput<RegistryIndexItem>): boolean => {
  const { hidden } = item;
  const slotMeta = hidden !== true && item.meta;
  const slotChatjs = slotMeta !== false && slotMeta && slotMeta.chatjs;
  const hasSlot =
    hidden !== true &&
    Boolean(slotChatjs !== false && slotChatjs && slotChatjs.slot);
  if (hidden === true || hasSlot) {
    return false;
  }
  return item.name !== "deep-research";
};

const assistantToolOptions = (
  items: readonly ReadonlyInput<RegistryIndexItem>[],
  supportedBuiltInTools: readonly BuiltInToolKey[]
): Option<string>[] => [
  ...supportedBuiltInTools.map((key) => ({
    hint: BUILT_IN_TOOL_HINTS[key],
    label: BUILT_IN_TOOL_LABELS[key],
    value: key,
  })),
  ...items.map((item: ReadonlyInput<RegistryIndexItem>) => ({
    hint: item.description,
    label: item.name,
    value: item.name,
  })),
];

const supportedAssistantTools = (
  gateway: ReadonlyInput<GatewayDefinition>
): BuiltInToolKey[] =>
  BUILT_IN_TOOL_KEYS.filter((key) => {
    if (key === "imageGeneration") {
      return (
        gateway.capabilities.image && Boolean(gateway.defaults.roles.image)
      );
    }
    if (key === "videoGeneration") {
      return (
        gateway.capabilities.video && Boolean(gateway.defaults.roles.video)
      );
    }
    return true;
  });

const promptAssistantTools = async (
  registryItems: readonly ReadonlyInput<RegistryIndexItem>[],
  skipPrompt: boolean,
  gateway: ReadonlyInput<GatewayDefinition>
): Promise<{
  builtInTools: Record<BuiltInToolKey, boolean>;
  installableTools: string[];
}> => {
  const installableItems = registryItems.filter((item) =>
    isInstallableTool(item)
  );
  const supportedBuiltInTools = supportedAssistantTools(gateway);

  if (skipPrompt) {
    return {
      builtInTools: { ...BUILT_IN_TOOL_DEFAULTS },
      installableTools: [],
    };
  }

  const selected = await multiselect({
    initialValues: supportedBuiltInTools.filter(
      (key) => BUILT_IN_TOOL_DEFAULTS[key]
    ),
    message: `Which ${highlighter.info("assistant tools")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: assistantToolOptions(installableItems, supportedBuiltInTools),
    required: false,
  });
  handleCancel(selected);

  const builtInTools = {
    deepResearch: selected.includes("deepResearch"),
    imageGeneration: selected.includes("imageGeneration"),
    videoGeneration: selected.includes("videoGeneration"),
  };

  return {
    builtInTools,
    installableTools: selected.filter(
      (value) => !(BUILT_IN_TOOL_KEYS as readonly string[]).includes(value)
    ),
  };
};
const promptAuth = async (
  skipPrompt: boolean
): Promise<Record<AuthProvider, boolean>> => {
  if (skipPrompt) {
    return { ...AUTH_DEFAULTS };
  }

  const defaultProviders = AUTH_PROVIDERS.filter(
    (provider) => AUTH_DEFAULTS[provider]
  );

  const selectedProviders = await multiselect({
    initialValues: defaultProviders,
    message: `Which ${highlighter.info("auth providers")} would you like to enable? ${highlighter.warn("(at least one required)")} ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: AUTH_PROVIDERS.map((provider) => ({
      hint: authEnvRequirements[provider].description,
      label: AUTH_LABELS[provider],
      value: provider,
    })),
    required: true,
  });
  handleCancel(selectedProviders);

  return {
    google: selectedProviders.includes("google"),
    github: selectedProviders.includes("github"),
    vercel: selectedProviders.includes("vercel"),
  };
};

const promptElectron = async (
  skipPrompt: boolean,
  explicitChoice?: boolean
): Promise<boolean> => {
  if (typeof explicitChoice === "boolean") {
    return explicitChoice;
  }

  if (skipPrompt) {
    return false;
  }

  const wantsElectron = await confirm({
    initialValue: false,
    message: `Include an ${highlighter.info("Electron")} desktop app?`,
  });
  handleCancel(wantsElectron);

  return wantsElectron;
};
const promptSandbox = async (
  skipPrompt: boolean
): Promise<string | undefined> => {
  if (skipPrompt) {
    return "default";
  }
  const choice = await select({
    message: "Which native EVE sandbox should the agent use?",
    options: [
      { label: "Automatic (EVE default)", value: "default" },
      { label: "Vercel Sandbox", value: "vercel" },
      { label: "Docker", value: "docker" },
      { label: "just-bash (no native Python or Node)", value: "just-bash" },
    ],
  });
  handleCancel(choice);
  return choice;
};
const promptImageGenerationTool = async (
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return "generate-image";
  }
  const choice = await select({
    message: "Which image generation tool should chat use?",
    options: [
      {
        hint: "Uses your gateway and file storage",
        label: "Selected AI gateway",
        value: "generate-image",
      },
      { label: "External registry item", value: "external" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") {
    return choice;
  }
  const address = await text({
    message: "image generation tool registry address:",
    validate: (value): "Enter an address" | undefined => {
      if (typeof value !== "string" || value.trim() === "") {
        return "Enter an address";
      }
      return undefined;
    },
  });
  handleCancel(address);
  return address.trim();
};
const promptVideoGenerationTool = async (
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return "generate-video";
  }
  const choice = await select({
    message: "Which video generation tool should chat use?",
    options: [
      {
        hint: "Uses your gateway and file storage",
        label: "Selected AI gateway",
        value: "generate-video",
      },
      { label: "External registry item", value: "external" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") {
    return choice;
  }
  const address = await text({
    message: "video generation tool registry address:",
    validate: (value): "Enter an address" | undefined => {
      if (typeof value !== "string" || value.trim() === "") {
        return "Enter an address";
      }
      return undefined;
    },
  });
  handleCancel(address);
  return address.trim();
};
export {
  promptAssistantTools,
  promptAuth,
  promptSandbox,
  promptCoreFeatures,
  promptElectron,
  promptGateway,
  promptImageGenerationTool,
  promptProjectName,
  promptStorage,
  promptVideoGenerationTool,
};
