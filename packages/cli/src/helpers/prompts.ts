import type { GatewayDefinition } from "@chat-js/gateways/definition";
import {
  cancel,
  confirm,
  isCancel,
  multiselect,
  select,
  text,
} from "@clack/prompts";
import type { Option } from "@clack/prompts";
import { PROVIDER_NAMES } from "files-sdk/providers";

import type { RegistryIndexItem } from "#cli/registry/schema";
import { resolveStorage } from "#cli/registry/storage";
import type { StorageSelection } from "#cli/registry/storage";
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
  DOCUMENT_TYPE_KEYS,
  GATEWAYS,
} from "#cli/types";
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  DocumentTypeKey,
  Gateway,
} from "#cli/types";
import { highlighter } from "#cli/utils/highlighter";
import { logger } from "#cli/utils/logger";

import {
  AUTHENTICATION_DEFAULTS,
  FEATURES_DEFAULTS,
  // oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
} from "../../../../apps/chat/lib/config-schema";
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import {
  authEnvRequirements,
  builtInToolEnvRequirements,
  coreFeatureEnvRequirements,
  gatewayEnvRequirements,
} from "./config-requirements";
/* oxlint-enable import/max-dependencies */
import type { ReadonlyInput } from "./readonly-input";
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

const BUILT_IN_TOOL_DEFAULTS: Readonly<Record<BuiltInToolKey, boolean>> = {
  codeExecution: false,
  deepResearch: false,
  imageGeneration: false,
  urlRetrieval: false,
  videoGeneration: false,
  webSearch: false,
};

const AUTH_LABELS: Record<AuthProvider, string> = {
  github: "GitHub OAuth",
  google: "Google OAuth",
  vercel: "Vercel OAuth",
};

const PROMPT_CANCEL_EXIT_CODE = 1;
const OBSERVABILITY_CANCEL_EXIT_CODE = 0;

const handleCancel: <PromptValue>(
  value: PromptValue
) => asserts value is Exclude<PromptValue, symbol> = (value) => {
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: A cancelled CLI prompt must terminate before its cancellation sentinel reaches command logic.
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

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
const toSelectionRecord = <T extends string>(
  keys: readonly T[],
  selected: readonly string[]
): Record<T, boolean> =>
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Prompt entries are constructed from the validated option catalog; Object.fromEntries loses the known key/value relationship.
  Object.fromEntries(
    keys.map((key) => [key, selected.includes(key)])
  ) as Record<T, boolean>;
/* oxlint-enable eslint/id-length */

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
      validate: (value) =>
        (value?.trim() ?? "") === ""
          ? "Enter a registry item address"
          : globalThis.undefined,
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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
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
        validate: (value) =>
          (value?.trim() ?? "") === ""
            ? "Enter an item address"
            : globalThis.undefined,
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
    (id) => id === builtin?.meta.chatjs.id
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
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

const promptCoreFeatures = async (
  skipPrompt: boolean,
  gateway: ReadonlyInput<GatewayDefinition>,
  mcp?: boolean
): Promise<Record<CoreFeatureKey, boolean>> => {
  const defaultTools = gateway.defaults.tools;
  const CORE_FEATURE_DEFAULTS: Record<CoreFeatureKey, boolean> = {
    attachments: false,
    documents: true,
    followupSuggestions: defaultTools.followupSuggestions.enabled,
    mcp: mcp ?? false,
    parallelResponses: FEATURES_DEFAULTS.parallelResponses,
  };

  if (skipPrompt) {
    return { ...CORE_FEATURE_DEFAULTS };
  }

  const availableFeatures = CORE_FEATURE_KEYS.filter(
    (key) => key !== "mcp" || mcp === globalThis.undefined
  );
  const selected = await multiselect({
    initialValues: availableFeatures.filter(
      (key) => CORE_FEATURE_DEFAULTS[key]
    ),
    message: `Which ${highlighter.info("core features")} would you like to enable? ${highlighter.dim("(space to toggle, enter to submit)")}`,
    options: availableFeatures.map((key) => ({
      hint:
        key === "documents"
          ? "Create, edit, and review documents in chat"
          : coreFeatureEnvRequirements[
              key as keyof typeof coreFeatureEnvRequirements
            ]
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

  const result = toSelectionRecord(CORE_FEATURE_KEYS, selected);
  result.mcp = mcp ?? result.mcp;
  return result;
};

const promptDocumentTypes = async (
  skipPrompt: boolean,
  documentsEnabled: boolean
): Promise<Record<DocumentTypeKey, boolean>> => {
  const DOCUMENT_TYPE_DEFAULTS: Record<DocumentTypeKey, boolean> = {
    code: true,
    sheet: true,
    text: true,
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

  return toSelectionRecord(DOCUMENT_TYPE_KEYS, selected);
};

const isInstallableTool = (item: ReadonlyInput<RegistryIndexItem>): boolean => {
  if (item.hidden === true) {
    return false;
  }
  const hasSlot = Boolean(item.meta?.chatjs?.slot);
  if (hasSlot) {
    return false;
  }
  const hasDocumentRun = Boolean(item.meta?.chatjs?.documentRunExport);
  return !hasDocumentRun && item.name !== "deep-research";
};

const assistantToolOptions = (
  items: readonly ReadonlyInput<RegistryIndexItem>[],
  supportedBuiltInTools: readonly BuiltInToolKey[]
): Option<string>[] => [
  ...supportedBuiltInTools.map((key) => ({
    hint:
      builtInToolEnvRequirements[key]?.description ?? BUILT_IN_TOOL_HINTS[key],
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
        gateway.capabilities.image &&
        Boolean(gateway.defaults.tools.image.default)
      );
    }
    if (key === "videoGeneration") {
      return (
        gateway.capabilities.video &&
        Boolean(gateway.defaults.tools.video.default)
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

  const builtInTools = toSelectionRecord(
    BUILT_IN_TOOL_KEYS,
    selected.filter((value): value is BuiltInToolKey =>
      (BUILT_IN_TOOL_KEYS as readonly string[]).includes(value)
    )
  );
  if (builtInTools.deepResearch) {
    builtInTools.webSearch = true;
  }

  return {
    builtInTools,
    installableTools: selected.filter(
      (value) => !(BUILT_IN_TOOL_KEYS as readonly string[]).includes(value)
    ),
  };
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const promptAuth = async (
  skipPrompt: boolean
): Promise<Record<AuthProvider, boolean>> => {
  if (skipPrompt) {
    return { ...AUTH_DEFAULTS };
  }

  const defaultProviders = AUTH_PROVIDERS.filter(
    (provider) => AUTH_DEFAULTS[provider]
  );

  let selectedProviders: AuthProvider[] = [];

  while (selectedProviders.length === 0) {
    // oxlint-disable-next-line no-await-in-loop -- Retry only after the user submits an empty selection.
    const selected = await multiselect({
      initialValues: defaultProviders,
      message: `Which ${highlighter.info("auth providers")} would you like to enable? ${highlighter.warn("(at least one required)")} ${highlighter.dim("(space to toggle, enter to submit)")}`,
      options: AUTH_PROVIDERS.map((provider) => ({
        hint: authEnvRequirements[provider].description,
        label: AUTH_LABELS[provider],
        value: provider,
      })),
      required: false,
    });
    handleCancel(selected);

    selectedProviders = selected;
    if (selectedProviders.length === 0) {
      logger.warn("At least one auth provider is required. Please select one.");
    }
  }

  return toSelectionRecord(AUTH_PROVIDERS, selectedProviders);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

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

const promptSearchTool = async (skipPrompt: boolean): Promise<string> => {
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
    validate: (value) =>
      (value?.trim() ?? "") === "" ? "Enter an address" : globalThis.undefined,
  });
  handleCancel(address);
  return address.trim();
};

const promptCodeExecutionTool = async (
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
      {
        hint: "Python and JavaScript; Daytona API key and organization required",
        label: "Daytona",
        value: "daytona-code-execution",
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
    validate: (value) =>
      (value?.trim() ?? "") === "" ? "Enter an address" : globalThis.undefined,
  });
  handleCancel(address);
  return address.trim();
};

const promptUrlRetrievalTool = async (skipPrompt: boolean): Promise<string> => {
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
    validate: (value) =>
      (value?.trim() ?? "") === "" ? "Enter an address" : globalThis.undefined,
  });
  handleCancel(address);
  return address.trim();
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
    validate: (value) =>
      (value?.trim() ?? "") === "" ? "Enter an address" : globalThis.undefined,
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
    validate: (value) =>
      (value?.trim() ?? "") === "" ? "Enter an address" : globalThis.undefined,
  });
  handleCancel(address);
  return address.trim();
};

// One optional group; new applications never enable telemetry by default.
const promptObservability = async (yes: boolean): Promise<string[]> => {
  if (yes) {
    return [];
  }
  const result = await multiselect({
    initialValues: [],
    message: "Optional observability integrations",
    options: [
      { label: "Vercel Analytics", value: "vercel-analytics" },
      { label: "Vercel Speed Insights", value: "vercel-speed-insights" },
      { label: "Langfuse", value: "langfuse" },
    ],
    required: false,
  });
  if (isCancel(result)) {
    cancel("Operation cancelled.");
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: A cancelled CLI prompt must terminate before its cancellation sentinel reaches command logic.
    process.exit(OBSERVABILITY_CANCEL_EXIT_CODE);
  }
  return result;
};

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
export {
  promptAssistantTools,
  promptAuth,
  promptCodeExecutionTool,
  promptCoreFeatures,
  promptDocumentTypes,
  promptElectron,
  promptGateway,
  promptImageGenerationTool,
  promptObservability,
  promptProjectName,
  promptSearchTool,
  promptStorage,
  promptUrlRetrievalTool,
  promptVideoGenerationTool,
};
