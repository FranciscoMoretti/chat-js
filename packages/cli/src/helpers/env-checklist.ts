import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
} from "#cli/types";
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  Gateway,
} from "#cli/types";

import {
  authEnvRequirements,
  builtInToolEnvRequirements,
  coreFeatureEnvRequirements,
  envVarDescriptions,
  gatewayEnvRequirements,
} from "./config-requirements";

interface EnvRequirementLike {
  readonly description?: string;
  readonly options: readonly (readonly string[])[];
}

interface EnvVarEntry {
  /** The env var name(s), e.g. "AI_GATEWAY_API_KEY" or "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET" */
  vars: string;
  /** Human-readable description derived from the Zod schema */
  description: string;
  /** Group key used to render "one of" alternatives together */
  oneOfGroup?: string;
}

const envDescriptions = new Map(Object.entries(envVarDescriptions));
const singleAlternative = 1;

interface EnvChecklistInput {
  readonly gateway: Gateway;
  readonly gatewayRequirements?: readonly EnvRequirementLike[];
  readonly coreFeatures: Readonly<Record<CoreFeatureKey, boolean>>;
  readonly builtInTools: Readonly<Record<BuiltInToolKey, boolean>>;
  readonly auth: Readonly<Record<AuthProvider, boolean>>;
  readonly installableToolEnvRequirements?: readonly EnvRequirementLike[];
}

/**
 * Expand an EnvRequirement into one or more EnvVarEntries, pulling
 * descriptions from the Zod schema.
 * @param {EnvRequirementLike} requirement The alternatives to expand without modifying their catalog.
 * @returns {EnvVarEntry[]} One checklist entry per credential alternative.
 */
const requirementToEntries = (
  requirement: EnvRequirementLike
): EnvVarEntry[] => {
  // oxlint-disable-next-line eslint/no-undefined -- Preserve the own oneOfGroup property as undefined for a single credential alternative.
  let oneOfGroup: string | undefined = undefined;
  if (requirement.options.length > singleAlternative) {
    oneOfGroup = requirement.options
      .map((group) => group.map(String).join("+"))
      .join("|");
  }

  return requirement.options.map((group) => {
    let description = group
      .map((variableName) => envDescriptions.get(variableName) ?? variableName)
      .join(", ");

    if (description === "") {
      const fallbackDescription = requirement.description;
      description = "Required environment variable";
      if (
        typeof fallbackDescription === "string" &&
        fallbackDescription !== ""
      ) {
        description = fallbackDescription;
      }
    }
    return {
      description,
      oneOfGroup,
      vars: group.map(String).join(" + "),
    };
  });
};

interface RequirementCollector {
  readonly entries: EnvVarEntry[];
  readonly add: (requirement: EnvRequirementLike | undefined) => void;
}

const requirementCollector = (): RequirementCollector => {
  const entries: EnvVarEntry[] = [];
  const seen = new Set<string>();
  const add = (requirement: EnvRequirementLike | undefined): void => {
    if (!requirement) {
      return;
    }
    const dedupeKey = JSON.stringify(
      requirement.options
        .map((group) => group.toSorted())
        .toSorted(
          (leftEntry: readonly string[], rightEntry: readonly string[]) =>
            JSON.stringify(leftEntry).localeCompare(JSON.stringify(rightEntry))
        )
    );
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      entries.push(...requirementToEntries(requirement));
    }
  };
  return { add, entries };
};

const collectCoreFeatureEntries = (
  input: EnvChecklistInput,
  add: RequirementCollector["add"]
): void => {
  for (const feature of CORE_FEATURE_KEYS) {
    if (input.coreFeatures[feature]) {
      for (const requirement of coreFeatureEnvRequirements[feature] ?? []) {
        add(requirement);
      }
    }
  }
};

const collectFeatureEntries = (input: EnvChecklistInput): EnvVarEntry[] => {
  const collector = requirementCollector();
  collectCoreFeatureEntries(input, collector.add);
  for (const tool of BUILT_IN_TOOL_KEYS) {
    if (
      tool !== "webSearch" &&
      tool !== "urlRetrieval" &&
      tool !== "deepResearch" &&
      tool !== "codeExecution" &&
      input.builtInTools[tool]
    ) {
      collector.add(builtInToolEnvRequirements[tool]);
    }
  }
  for (const requirement of input.installableToolEnvRequirements ?? []) {
    collector.add(requirement);
  }
  return collector.entries;
};

const collectAuthEntries = (input: EnvChecklistInput): EnvVarEntry[] => {
  const authItems: EnvVarEntry[] = [];

  // Filtering preserves Object.keys insertion order while narrowing the closed
  // provider contract without assuming Object.keys returns that union.
  const providers = Object.keys(authEnvRequirements).filter(
    (provider): provider is AuthProvider =>
      AUTH_PROVIDERS.some((candidate) => candidate === provider)
  );
  for (const provider of providers) {
    if (input.auth[provider]) {
      authItems.push(...requirementToEntries(authEnvRequirements[provider]));
    }
  }

  return authItems;
};

const collectEnvChecklist = (input: EnvChecklistInput): EnvVarEntry[] => {
  const entries: EnvVarEntry[] = [
    {
      description: envDescriptions.get("AUTH_SECRET") ?? "AUTH_SECRET",
      vars: "AUTH_SECRET",
    },
    {
      description: envDescriptions.get("DATABASE_URL") ?? "DATABASE_URL",
      vars: "DATABASE_URL",
    },
  ];

  const gwReq =
    input.gatewayRequirements ?? gatewayEnvRequirements[input.gateway] ?? [];
  return [
    ...entries,
    ...gwReq.flatMap((requirement) => requirementToEntries(requirement)),
    ...collectFeatureEntries(input),
    ...collectAuthEntries(input),
  ];
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (collectEnvChecklist); the enabled import/no-default-export convention rejects the default-export alternative. */
export { collectEnvChecklist };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EnvVarEntry); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { EnvVarEntry };
/* oxlint-enable import/no-named-export */
