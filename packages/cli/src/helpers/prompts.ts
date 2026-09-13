import type { GatewayDefinition } from "@chat-js/gateways/definition";
import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from "@clack/prompts";
import { PROVIDER_NAMES } from "files-sdk/providers";

import {
  AUTHENTICATION_DEFAULTS,
  FEATURES_DEFAULTS,
} from "../../../../apps/chat/lib/config-schema";
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
import type { RegistryIndexItem } from "../registry/schema";
import { resolveStorage } from "../registry/storage";
import type { StorageSelection } from "../registry/storage";
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  DOCUMENT_TYPE_KEYS,
  GATEWAYS,
} from "../types";
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  DocumentTypeKey,
  Gateway,
} from "../types";
import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";
import {
  authEnvRequirements,
  builtInToolEnvRequirements,
  coreFeatureEnvRequirements,
  gatewayEnvRequirements,
} from "./config-requirements";
import {
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
} from "./storage-provider";

const AUTH_DEFAULTS: Record<AuthProvider, boolean> = AUTHENTICATION_DEFAULTS;

const CORE_FEATURE_LABELS: Record<CoreFeatureKey, string> = {
  attachments: "Attachments",
  documents: "Documents",
  followupSuggestions: "Follow-up Suggestions",
  mcp: "MCP Tool Servers",
  parallelResponses: "Parallel Responses",
};

const DOCUMENT_TYPE_LABELS: Record<DocumentTypeKey, string> = {
  code: "Code Documents",
  sheet: "Spreadsheet Documents",
  text: "Text Documents",
};

const DOCUMENT_TYPE_HINTS: Record<DocumentTypeKey, string> = {
  code: "Code files and snippets",
  sheet: "CSV-based tables and structured data",
  text: "Notes, guides, markdown, and long-form writing",
};

const BUILT_IN_TOOL_LABELS: Record<BuiltInToolKey, string> = {
  codeExecution: "Code Sandbox",
  deepResearch: "Deep Research",
  imageGeneration: "Image Generation",
  urlRetrieval: "URL Retrieval",
  videoGeneration: "Video Generation",
  webSearch: "Web Search",
};

const BUILT_IN_TOOL_HINTS: Record<BuiltInToolKey, string> = {
  codeExecution: "Execute code in a sandboxed environment",
  deepResearch: "Run multi-step web research and generate reports",
  imageGeneration: "Generate images inside chat",
  urlRetrieval: "Fetch structured content from a specific URL",
  videoGeneration: "Generate videos inside chat",
  webSearch: "Search the web from chat",
};

const AUTH_LABELS: Record<AuthProvider, string> = {
  github: "GitHub OAuth",
  google: "Google OAuth",
  vercel: "Vercel OAuth",
};

const handleCancel: (value: unknown) => asserts value is never = (value) => {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(1);
  }
};

const toKebabCase = (value: string | undefined): string =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/gu, "-")
    .replaceAll(/-+/gu, "-")
    .replaceAll(/^-|-$/gu, "");

const toSelectionRecord = <T extends string>(
  keys: readonly T[],
  selected: readonly string[]
): Record<T, boolean> =>
  Object.fromEntries(
    keys.map((key) => [key, selected.includes(key)])
  ) as Record<T, boolean>;

export const promptProjectName = async (
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
    },
  });
  handleCancel(name);

  return toKebabCase(name) || "my-chat-app";
};

export const promptGateway = async (skipPrompt: boolean): Promise<Gateway> => {
  if (skipPrompt) {
    return "vercel";
  }

  const gateway = await select({
    initialValue: "vercel" as Gateway,
    message: `Which ${highlighter.info("AI gateway")} would you like to use?`,
    options: [
      ...GATEWAYS.map((gw) => ({
        hint: gatewayEnvRequirements[gw]
          .map((requirement) => requirement.description)
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
      validate: (value) =>
        value?.trim() ? undefined : "Enter a registry item address",
    });
    handleCancel(source);
    return String(source).trim();
  }
  return gateway;
};

export const promptStorage = async (
  skipPrompt: boolean,
  explicitProvider?: string,
  explicitOptions?: string,
  cwd = process.cwd()
): Promise<StorageSelection> => {
  let source = explicitProvider ?? "vercel-blob";
  if (!explicitProvider && !skipPrompt) {
    const choice = await select({
      initialValue: "vercel-blob",
      message: "Which file storage provider would you like to use?",
      options: [
        ...INSTALLABLE_STORAGE_PROVIDERS.map((item) => ({
          label: item.title,
          value: item.meta.chatjs.id,
        })),
        {
          hint: "Namespace, URL or local JSON path",
          label: "External registry item",
          value: "__external__",
        },
      ],
    });
    handleCancel(choice);
    source = String(choice);
    if (source === "__external__") {
      const address = await text({
        message: "Storage registry item address:",
        validate: (v) => (v?.trim() ? undefined : "Enter an item address"),
      });
      handleCancel(address);
      source = String(address).trim();
    }
  }
  const selection = await resolveStorage(source, cwd);
  const keys = selection.definition.configKeys;
  let options = explicitOptions;
  if (options === undefined && keys.length) {
    if (skipPrompt) {
      throw new Error(
        `Storage requires adapter options (${keys.join(", ")}). Pass --storage-config.`
      );
    }
    const input = await text({
      message: `Non-secret adapter options as JSON (${keys.join(", ")}). Credentials use environment variables.`,
      validate: (v) => {
        try {
          parseStorageOptions(v ?? "");
        } catch {
          return "Enter a JSON object";
        }
      },
    });
    handleCancel(input);
    options = String(input);
  }
  selection.options = options === undefined ? {} : parseStorageOptions(options);
  // Only the actual built-in address uses SDK-derived option/credential rules.
  // An external item may use the same id with its own contract.
  const builtin = INSTALLABLE_STORAGE_PROVIDERS.find(
    (item) => selection.source === `@chatjs/${item.name}`
  );
  const providerId = PROVIDER_NAMES.find(
    (id) => id === builtin?.meta.chatjs.id
  );
  if (providerId) {
    selection.definition.envRequirements = getStorageEnvironmentRequirements(
      providerId,
      selection.options
    ).map((r) => ({
      description: r.description,
      options: r.options.flatMap((option) => {
        let alternatives: string[][] = [[]];
        for (const variable of option) {
          alternatives = alternatives.flatMap((alternative) =>
            [variable.key, ...variable.aliases].map((key) => [
              ...alternative,
              key,
            ])
          );
        }
        return alternatives;
      }),
    }));
  }
  return selection;
};

export const promptCoreFeatures = async (
  skipPrompt: boolean,
  gateway: GatewayDefinition
): Promise<Record<CoreFeatureKey, boolean>> => {
  const defaultTools = gateway.defaults.tools;
  const CORE_FEATURE_DEFAULTS: Record<CoreFeatureKey, boolean> = {
    attachments: FEATURES_DEFAULTS.attachments,
    documents: defaultTools.documents.enabled,
    followupSuggestions: defaultTools.followupSuggestions.enabled,
    mcp: defaultTools.mcp.enabled,
    parallelResponses: FEATURES_DEFAULTS.parallelResponses,
  };

  if (skipPrompt) {
    return { ...CORE_FEATURE_DEFAULTS };
  }

  const selected = await multiselect({
    initialValues: CORE_FEATURE_KEYS.filter(
      (key) => CORE_FEATURE_DEFAULTS[key]
    ),
    message: `Which ${highlighter.info("core features")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: CORE_FEATURE_KEYS.map((key) => ({
      hint:
        key === "documents"
          ? "Create, edit, and review documents in chat"
          : coreFeatureEnvRequirements[
              key as keyof typeof coreFeatureEnvRequirements
            ]?.description,
      label: CORE_FEATURE_LABELS[key],
      value: key,
    })),
    required: false,
  });
  handleCancel(selected);

  return toSelectionRecord(CORE_FEATURE_KEYS, selected as CoreFeatureKey[]);
};

export const promptDocumentTypes = async (
  skipPrompt: boolean,
  documentsEnabled: boolean,
  gateway: GatewayDefinition
): Promise<Record<DocumentTypeKey, boolean>> => {
  const defaultTools = gateway.defaults.tools;
  const DOCUMENT_TYPE_DEFAULTS: Record<DocumentTypeKey, boolean> = {
    code: defaultTools.documents.types.code,
    sheet: defaultTools.documents.types.sheet,
    text: defaultTools.documents.types.text,
  };

  if (!documentsEnabled) {
    return toSelectionRecord(DOCUMENT_TYPE_KEYS, []);
  }

  if (skipPrompt) {
    return { ...DOCUMENT_TYPE_DEFAULTS };
  }

  const selected = await multiselect({
    initialValues: DOCUMENT_TYPE_KEYS.filter(
      (key) => DOCUMENT_TYPE_DEFAULTS[key]
    ),
    message: `Which ${highlighter.info("document types")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: DOCUMENT_TYPE_KEYS.map((key) => ({
      hint: DOCUMENT_TYPE_HINTS[key],
      label: DOCUMENT_TYPE_LABELS[key],
      value: key,
    })),
    required: false,
  });
  handleCancel(selected);

  return toSelectionRecord(DOCUMENT_TYPE_KEYS, selected as DocumentTypeKey[]);
};

export const promptAssistantTools = async (
  registryItems: RegistryIndexItem[],
  skipPrompt: boolean,
  gateway: GatewayDefinition
): Promise<{
  builtInTools: Record<BuiltInToolKey, boolean>;
  installableTools: string[];
}> => {
  const defaultTools = gateway.defaults.tools;
  const BUILT_IN_TOOL_DEFAULTS: Record<BuiltInToolKey, boolean> = {
    codeExecution: defaultTools.codeExecution.enabled,
    deepResearch: defaultTools.deepResearch.enabled,
    imageGeneration: defaultTools.image.enabled,
    urlRetrieval: defaultTools.urlRetrieval.enabled,
    videoGeneration: defaultTools.video.enabled,
    webSearch:
      defaultTools.webSearch.enabled || defaultTools.deepResearch.enabled,
  };

  const installableItems = registryItems.filter(
    (item) => !item.hidden && !item.meta?.chatjs?.slot
  );
  const supportedBuiltInTools = BUILT_IN_TOOL_KEYS;

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
    options: [
      ...supportedBuiltInTools.map((key) => ({
        hint:
          builtInToolEnvRequirements[
            key as keyof typeof builtInToolEnvRequirements
          ]?.description ?? BUILT_IN_TOOL_HINTS[key],
        label: BUILT_IN_TOOL_LABELS[key],
        value: key,
      })),
      ...installableItems.map((item) => ({
        hint: item.description,
        label: item.name,
        value: item.name,
      })),
    ],
    required: false,
  });
  handleCancel(selected);

  const selectedValues = selected as string[];
  const builtInTools = toSelectionRecord(
    BUILT_IN_TOOL_KEYS,
    selectedValues.filter((value): value is BuiltInToolKey =>
      (BUILT_IN_TOOL_KEYS as readonly string[]).includes(value)
    )
  );
  if (builtInTools.deepResearch) {
    builtInTools.webSearch = true;
  }

  return {
    builtInTools,
    installableTools: selectedValues.filter(
      (value) => !(BUILT_IN_TOOL_KEYS as readonly string[]).includes(value)
    ),
  };
};

export const promptAuth = async (
  skipPrompt: boolean
): Promise<Record<AuthProvider, boolean>> => {
  if (skipPrompt) {
    return { ...AUTH_DEFAULTS };
  }

  const defaultProviders = AUTH_PROVIDERS.filter((p) => AUTH_DEFAULTS[p]);

  let selectedProviders: AuthProvider[] = [];

  while (selectedProviders.length === 0) {
    const selected = await multiselect({
      initialValues: defaultProviders,
      message: `Which ${highlighter.info("auth providers")} would you like to enable? ${highlighter.warn("(at least one required)")} ${highlighter.dim("(space to toggle, enter to submit)")}`,
      options: AUTH_PROVIDERS.map((p) => ({
        hint: authEnvRequirements[p].description,
        label: AUTH_LABELS[p],
        value: p,
      })),
      required: false,
    });
    handleCancel(selected);

    selectedProviders = selected as AuthProvider[];
    if (selectedProviders.length === 0) {
      logger.warn("At least one auth provider is required. Please select one.");
    }
  }

  return toSelectionRecord(AUTH_PROVIDERS, selectedProviders);
};

export const promptElectron = async (
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

export const promptSearchTool = async (
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return "tavily-search";
  }
  const choice = await select({
    message: "Which web search tool should chat and deep research use?",
    options: [
      {
        hint: "Requires TAVILY_API_KEY",
        label: "Tavily",
        value: "tavily-search",
      },
      {
        hint: "Requires FIRECRAWL_API_KEY",
        label: "Firecrawl",
        value: "firecrawl-search",
      },
      { label: "External registry item", value: "external" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") {
    return choice;
  }
  const address = await text({
    message: "Search tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
};

export const promptCodeExecutionTool = async (
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return "vercel-code-execution";
  }
  const choice = await select({
    message: "Which code-execution tool should chat use?",
    options: [
      {
        hint: "Python and JavaScript; Vercel credentials required",
        label: "Vercel Sandbox",
        value: "vercel-code-execution",
      },
      { label: "External registry item", value: "external" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") {
    return choice;
  }
  const address = await text({
    message: "Code-execution tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
};

export const promptUrlRetrievalTool = async (
  skipPrompt: boolean
): Promise<string> => {
  if (skipPrompt) {
    return "retrieve-url";
  }
  const choice = await select({
    message: "Which URL retrieval tool should chat use?",
    options: [
      {
        hint: "Requires FIRECRAWL_API_KEY",
        label: "Firecrawl",
        value: "retrieve-url",
      },
      { label: "External registry item", value: "external" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") {
    return choice;
  }
  const address = await text({
    message: "URL retrieval tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
};

export const promptImageGenerationTool = async (
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
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
};

export const promptVideoGenerationTool = async (
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
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
};
