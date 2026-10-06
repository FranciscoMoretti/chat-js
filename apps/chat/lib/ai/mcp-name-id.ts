const UNDERSCORE_COLLAPSE_REGEX = /_+/gu;
const UNDERSCORE_TRIM_REGEX = /^_|_$/gu;
const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]/gu;

/** Maximum length for connector names */
const MCP_NAME_MAX_LENGTH = 20;

/** Reserved namespace prefix for global connectors (userId = null) */
const GLOBAL_NAMESPACE_PREFIX = "global";

/** Separator between namespace and tool name (OpenAI requires ^[a-zA-Z0-9_-]+$) */
const TOOL_ID_SEPARATOR = "__";

type GenerateMcpNameIdResult =
  | { ok: true; nameId: string }
  | { ok: false; error: "empty" | "reserved" };

/**
 * Generates a namespace (nameId) from a connector name.
 * Rules:
 * - Lowercase, replace non-alphanumeric with underscores
 * - Collapse consecutive underscores, trim leading/trailing
 * - Cannot equal "global" exactly (reserved for global connectors)
 * - Cannot result in empty string
 * @param {string} name - Connector display name to normalize; normalization does not enforce the separate maximum-length limit.
 * @returns {GenerateMcpNameIdResult} Normalized namespace or an empty/reserved-name rejection.
 */
const generateMcpNameId = (name: string): GenerateMcpNameIdResult => {
  const nameId = name
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, "_")
    .replace(UNDERSCORE_COLLAPSE_REGEX, "_")
    .replace(UNDERSCORE_TRIM_REGEX, "");

  if (!nameId) {
    return { error: "empty", ok: false };
  }

  if (nameId === GLOBAL_NAMESPACE_PREFIX) {
    return { error: "reserved", ok: false };
  }

  return { nameId, ok: true };
};

/**
 * Creates a fully qualified tool ID from namespace and tool name.
 * Format: `{namespace}__{toolName}`
 * For global connectors: `global__{nameId}__{toolName}`
 * Uses `__` separator for OpenAI compatibility (requires ^[a-zA-Z0-9_-]+$)
 * @param {string} namespace - Connector namespace to embed without further normalization.
 * @param {string} toolName - Tool name to append without validation or escaping.
 * @param {boolean} isGlobal - Whether to prefix the global connector namespace.
 * @returns {string} Qualified tool identifier with the selected namespace prefix.
 */
const createToolId = (
  namespace: string,
  toolName: string,
  isGlobal: boolean
): string => {
  if (isGlobal) {
    return `${GLOBAL_NAMESPACE_PREFIX}${TOOL_ID_SEPARATOR}${namespace}${TOOL_ID_SEPARATOR}${toolName}`;
  }
  return `${namespace}${TOOL_ID_SEPARATOR}${toolName}`;
};

/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null --
max-statements (#512): parseToolId keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-magic-numbers (#517): parseToolId uses -1, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
unicorn/no-null (#570): parseToolId preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Parses a tool ID back into its components.
 * Splits on `__` separator to get namespace and tool name.
 * For global tools, returns { isGlobal: true, namespace, toolName }
 * @param {string} toolId - Qualified identifier to split at the user or global namespace boundary.
 * @returns {{ isGlobal: boolean; namespace: string; toolName: string } | null} Parsed components, preserving empty components and later separators, or null when a required separator is missing.
 */
const parseToolId = (
  toolId: string
): {
  isGlobal: boolean;
  namespace: string;
  toolName: string;
} | null => {
  const firstSep = toolId.indexOf(TOOL_ID_SEPARATOR);
  if (firstSep === -1) {
    // No namespace, not an MCP tool.
    return null;
  }

  const firstPart = toolId.slice(0, firstSep);
  const rest = toolId.slice(firstSep + TOOL_ID_SEPARATOR.length);

  if (firstPart === GLOBAL_NAMESPACE_PREFIX) {
    // Global tool: global__{namespace}__{toolName}
    const secondSep = rest.indexOf(TOOL_ID_SEPARATOR);
    if (secondSep === -1) {
      // The global prefix must be followed by a namespace and a tool name.
      return null;
    }
    return {
      isGlobal: true,
      namespace: rest.slice(0, secondSep),
      toolName: rest.slice(secondSep + TOOL_ID_SEPARATOR.length),
    };
  }

  // User tool: {namespace}__{toolName}
  return {
    isGlobal: false,
    namespace: firstPart,
    toolName: rest,
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createToolId, generateMcpNameId, MCP_NAME_MAX_LENGTH, parseToolId); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */
export { createToolId, generateMcpNameId, MCP_NAME_MAX_LENGTH, parseToolId };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (GenerateMcpNameIdResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { GenerateMcpNameIdResult };
/* oxlint-enable import/no-named-export */
