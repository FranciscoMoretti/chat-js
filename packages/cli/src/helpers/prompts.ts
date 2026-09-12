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
import { resolveStorage, type StorageSelection } from "../registry/storage";
import {
  AUTH_PROVIDERS,
  type AuthProvider,
  BUILT_IN_TOOL_KEYS,
  type BuiltInToolKey,
  CORE_FEATURE_KEYS,
  type CoreFeatureKey,
  DOCUMENT_TYPE_KEYS,
  type DocumentTypeKey,
  GATEWAYS,
  type Gateway,
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
  parallelResponses: "Parallel Responses",
  documents: "Documents",
  mcp: "MCP Tool Servers",
  followupSuggestions: "Follow-up Suggestions",
};

const DOCUMENT_TYPE_LABELS: Record<DocumentTypeKey, string> = {
  text: "Text Documents",
  code: "Code Documents",
  sheet: "Spreadsheet Documents",
};

const DOCUMENT_TYPE_HINTS: Record<DocumentTypeKey, string> = {
  text: "Notes, guides, markdown, and long-form writing",
  code: "Code files and snippets",
  sheet: "CSV-based tables and structured data",
};

const BUILT_IN_TOOL_LABELS: Record<BuiltInToolKey, string> = {
  webSearch: "Web Search",
  urlRetrieval: "URL Retrieval",
  deepResearch: "Deep Research",
  codeExecution: "Code Sandbox",
  imageGeneration: "Image Generation",
  videoGeneration: "Video Generation",
};

const BUILT_IN_TOOL_HINTS: Record<BuiltInToolKey, string> = {
  webSearch: "Search the web from chat",
  urlRetrieval: "Fetch structured content from a specific URL",
  deepResearch: "Run multi-step web research and generate reports",
  codeExecution: "Execute code in a sandboxed environment",
  imageGeneration: "Generate images inside chat",
  videoGeneration: "Generate videos inside chat",
};

function isSupportedBuiltInTool(
  gateway: GatewayDefinition,
  key: BuiltInToolKey
): boolean {
  const gatewayToolDefaults = gateway.defaults.tools;

  if (key === "imageGeneration") {
    return (
      gateway.capabilities.image &&
      typeof gatewayToolDefaults.image.default === "string"
    );
  }

  if (key === "videoGeneration") {
    return (
      gateway.capabilities.video &&
      typeof gatewayToolDefaults.video.default === "string"
    );
  }

  return true;
}

const AUTH_LABELS: Record<AuthProvider, string> = {
  google: "Google OAuth",
  github: "GitHub OAuth",
  vercel: "Vercel OAuth",
};

function handleCancel(value: unknown): asserts value is never {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    process.exit(1);
  }
}

function toKebabCase(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toSelectionRecord<T extends string>(
  keys: readonly T[],
  selected: readonly string[]
): Record<T, boolean> {
  return Object.fromEntries(
    keys.map((key) => [key, selected.includes(key)])
  ) as Record<T, boolean>;
}

export async function promptProjectName(
  targetArg: string | undefined,
  skipPrompt: boolean
): Promise<string> {
  if (skipPrompt) {
    return toKebabCase(targetArg ?? "my-chat-app") || "my-chat-app";
  }

  const name = await text({
    message: "What is your project named?",
    initialValue: targetArg ?? "my-chat-app",
    validate: (value?: string) => {
      const kebab = toKebabCase(value);
      if (!kebab) return "Please enter a valid project name";
    },
  });
  handleCancel(name);

  return toKebabCase(name) || "my-chat-app";
}

export async function promptGateway(skipPrompt: boolean): Promise<Gateway> {
  if (skipPrompt) return "vercel";

  const gateway = await select({
    message: `Which ${highlighter.info("AI gateway")} would you like to use?`,
    options: [
      ...GATEWAYS.map((gw) => ({
        value: gw,
        label: gw,
        hint: gatewayEnvRequirements[gw]
          .map((requirement) => requirement.description)
          .join("; "),
      })),
      {
        value: "__external__",
        label: "External registry item",
        hint: "URL or local JSON path",
      },
    ],
    initialValue: "vercel" as Gateway,
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
}

export async function promptStorage(
  skipPrompt: boolean,
  explicitProvider?: string,
  explicitOptions?: string,
  cwd = process.cwd()
): Promise<StorageSelection> {
  let source = explicitProvider ?? "vercel-blob";
  if (!explicitProvider && !skipPrompt) {
    const choice = await select({
      message: "Which file storage provider would you like to use?",
      options: [
        ...INSTALLABLE_STORAGE_PROVIDERS.map((item) => ({
          value: item.meta.chatjs.id,
          label: item.title,
        })),
        {
          value: "__external__",
          label: "External registry item",
          hint: "Namespace, URL or local JSON path",
        },
      ],
      initialValue: "vercel-blob",
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
    if (skipPrompt)
      throw new Error(
        `Storage requires adapter options (${keys.join(", ")}). Pass --storage-config.`
      );
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
      options: r.options.flatMap((option) =>
        option.reduce<string[][]>(
          (alternatives, variable) =>
            alternatives.flatMap((keys) =>
              [variable.key, ...variable.aliases].map((key) => [...keys, key])
            ),
          [[]]
        )
      ),
    }));
  }
  return selection;
}

export async function promptCoreFeatures(
  skipPrompt: boolean,
  gateway: GatewayDefinition
): Promise<Record<CoreFeatureKey, boolean>> {
  const defaultTools = gateway.defaults.tools;
  const CORE_FEATURE_DEFAULTS: Record<CoreFeatureKey, boolean> = {
    attachments: FEATURES_DEFAULTS.attachments,
    parallelResponses: FEATURES_DEFAULTS.parallelResponses,
    documents: defaultTools.documents.enabled,
    mcp: defaultTools.mcp.enabled,
    followupSuggestions: defaultTools.followupSuggestions.enabled,
  };

  if (skipPrompt) return { ...CORE_FEATURE_DEFAULTS };

  const selected = await multiselect({
    message: `Which ${highlighter.info("core features")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: CORE_FEATURE_KEYS.map((key) => ({
      value: key,
      label: CORE_FEATURE_LABELS[key],
      hint:
        key === "documents"
          ? "Create, edit, and review documents in chat"
          : coreFeatureEnvRequirements[
              key as keyof typeof coreFeatureEnvRequirements
            ]?.description,
    })),
    initialValues: CORE_FEATURE_KEYS.filter(
      (key) => CORE_FEATURE_DEFAULTS[key]
    ),
    required: false,
  });
  handleCancel(selected);

  return toSelectionRecord(CORE_FEATURE_KEYS, selected as CoreFeatureKey[]);
}

export async function promptDocumentTypes(
  skipPrompt: boolean,
  documentsEnabled: boolean,
  gateway: GatewayDefinition
): Promise<Record<DocumentTypeKey, boolean>> {
  const defaultTools = gateway.defaults.tools;
  const DOCUMENT_TYPE_DEFAULTS: Record<DocumentTypeKey, boolean> = {
    text: defaultTools.documents.types.text,
    code: defaultTools.documents.types.code,
    sheet: defaultTools.documents.types.sheet,
  };

  if (!documentsEnabled) {
    return toSelectionRecord(DOCUMENT_TYPE_KEYS, []);
  }

  if (skipPrompt) return { ...DOCUMENT_TYPE_DEFAULTS };

  const selected = await multiselect({
    message: `Which ${highlighter.info("document types")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: DOCUMENT_TYPE_KEYS.map((key) => ({
      value: key,
      label: DOCUMENT_TYPE_LABELS[key],
      hint: DOCUMENT_TYPE_HINTS[key],
    })),
    initialValues: DOCUMENT_TYPE_KEYS.filter(
      (key) => DOCUMENT_TYPE_DEFAULTS[key]
    ),
    required: false,
  });
  handleCancel(selected);

  return toSelectionRecord(DOCUMENT_TYPE_KEYS, selected as DocumentTypeKey[]);
}

export async function promptAssistantTools(
  registryItems: RegistryIndexItem[],
  skipPrompt: boolean,
  gateway: GatewayDefinition
): Promise<{
  builtInTools: Record<BuiltInToolKey, boolean>;
  installableTools: string[];
}> {
  const defaultTools = gateway.defaults.tools;
  const BUILT_IN_TOOL_DEFAULTS: Record<BuiltInToolKey, boolean> = {
    webSearch:
      defaultTools.webSearch.enabled || defaultTools.deepResearch.enabled,
    urlRetrieval: defaultTools.urlRetrieval.enabled,
    deepResearch: defaultTools.deepResearch.enabled,
    codeExecution: defaultTools.codeExecution.enabled,
    imageGeneration: defaultTools.image.enabled,
    videoGeneration: defaultTools.video.enabled,
  };

  const installableItems = registryItems.filter(
    (item) => !item.hidden && !item.meta?.chatjs?.slot
  );
  const supportedBuiltInTools = BUILT_IN_TOOL_KEYS.filter((key) =>
    isSupportedBuiltInTool(gateway, key)
  );

  if (skipPrompt) {
    return {
      builtInTools: { ...BUILT_IN_TOOL_DEFAULTS },
      installableTools: [],
    };
  }

  const selected = await multiselect({
    message: `Which ${highlighter.info("assistant tools")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: [
      ...supportedBuiltInTools.map((key) => ({
        value: key,
        label: BUILT_IN_TOOL_LABELS[key],
        hint:
          builtInToolEnvRequirements[
            key as keyof typeof builtInToolEnvRequirements
          ]?.description ?? BUILT_IN_TOOL_HINTS[key],
      })),
      ...installableItems.map((item) => ({
        value: item.name,
        label: item.name,
        hint: item.description,
      })),
    ],
    initialValues: supportedBuiltInTools.filter(
      (key) => BUILT_IN_TOOL_DEFAULTS[key]
    ),
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
}

export async function promptAuth(
  skipPrompt: boolean
): Promise<Record<AuthProvider, boolean>> {
  if (skipPrompt) return { ...AUTH_DEFAULTS };

  const defaultProviders = AUTH_PROVIDERS.filter((p) => AUTH_DEFAULTS[p]);

  let selectedProviders: AuthProvider[] = [];

  while (selectedProviders.length === 0) {
    const selected = await multiselect({
      message: `Which ${highlighter.info("auth providers")} would you like to enable? ${highlighter.warn("(at least one required)")} ${highlighter.dim("(space to toggle, enter to submit)")}`,
      options: AUTH_PROVIDERS.map((p) => ({
        value: p,
        label: AUTH_LABELS[p],
        hint: authEnvRequirements[p].description,
      })),
      initialValues: defaultProviders,
      required: false,
    });
    handleCancel(selected);

    selectedProviders = selected as AuthProvider[];
    if (selectedProviders.length === 0) {
      logger.warn("At least one auth provider is required. Please select one.");
    }
  }

  return toSelectionRecord(AUTH_PROVIDERS, selectedProviders);
}

export async function promptElectron(
  skipPrompt: boolean,
  explicitChoice?: boolean
): Promise<boolean> {
  if (typeof explicitChoice === "boolean") {
    return explicitChoice;
  }

  if (skipPrompt) return false;

  const wantsElectron = await confirm({
    message: `Include an ${highlighter.info("Electron")} desktop app?`,
    initialValue: false,
  });
  handleCancel(wantsElectron);

  return wantsElectron;
}

export async function promptSearchTool(skipPrompt: boolean): Promise<string> {
  if (skipPrompt) return "tavily-search";
  const choice = await select({
    message: "Which web search tool should chat and deep research use?",
    options: [
      {
        value: "tavily-search",
        label: "Tavily",
        hint: "Requires TAVILY_API_KEY",
      },
      {
        value: "firecrawl-search",
        label: "Firecrawl",
        hint: "Requires FIRECRAWL_API_KEY",
      },
      { value: "external", label: "External registry item" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") return choice;
  const address = await text({
    message: "Search tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
}

export async function promptCodeExecutionTool(
  skipPrompt: boolean
): Promise<string> {
  if (skipPrompt) return "vercel-code-execution";
  const choice = await select({
    message: "Which code-execution tool should chat use?",
    options: [
      {
        value: "vercel-code-execution",
        label: "Vercel Sandbox",
        hint: "Python and JavaScript; Vercel credentials required",
      },
      { value: "external", label: "External registry item" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") return choice;
  const address = await text({
    message: "Code-execution tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
}

export async function promptUrlRetrievalTool(
  skipPrompt: boolean
): Promise<string> {
  if (skipPrompt) return "retrieve-url";
  const choice = await select({
    message: "Which URL retrieval tool should chat use?",
    options: [
      {
        value: "retrieve-url",
        label: "Firecrawl",
        hint: "Requires FIRECRAWL_API_KEY",
      },
      { value: "external", label: "External registry item" },
    ],
  });
  handleCancel(choice);
  if (choice !== "external") return choice;
  const address = await text({
    message: "URL retrieval tool registry address:",
    validate: (v) => (v?.trim() ? undefined : "Enter an address"),
  });
  handleCancel(address);
  return String(address).trim();
}
