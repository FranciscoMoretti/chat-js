/* oxlint-disable import/no-relative-parent-imports -- The CLI shares auth/tool key constants from its sibling types module; the published Bun bundle includes this import, and the existing @ alias points to apps/chat. */
import {
  AUTH_PROVIDERS,
  BUILT_IN_TOOL_KEYS,
  CORE_FEATURE_KEYS,
} from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- EnvChecklistInput uses the closed key unions declared in the CLI types module; the application @ alias cannot resolve this package-local type boundary. */
import type {
  AuthProvider,
  BuiltInToolKey,
  CoreFeatureKey,
  Gateway,
} from "../types";
/* oxlint-enable import/no-relative-parent-imports */
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

/* oxlint-disable typescript/consistent-type-definitions -- Keep this structural alias closed to declaration merging and compatible with the existing generic/record API. */
type EnvVarEntry = {
  /** The env var name(s), e.g. "AI_GATEWAY_API_KEY" or "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET" */
  vars: string;
  /** Human-readable description derived from the Zod schema */
  description: string;
  /** Group key used to render "one of" alternatives together */
  oneOfGroup?: string;
};
/* oxlint-enable typescript/consistent-type-definitions */

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
 * @param requirement The alternatives to expand without modifying their catalog.
 * @returns One checklist entry per credential alternative.
 */
const requirementToEntries = (
  requirement: EnvRequirementLike
): EnvVarEntry[] => {
  const oneOfGroup =
    requirement.options.length > singleAlternative
      ? requirement.options
          .map((group) => group.map(String).join("+"))
          .join("|")
      : // oxlint-disable-next-line eslint/no-undefined -- Preserve the own oneOfGroup property as undefined for a single credential alternative.
        undefined;

  return requirement.options.map((group) => {
    let description = group
      .map((variableName) => envDescriptions.get(variableName) ?? variableName)
      .join(", ");

    if (description === "") {
      const fallbackDescription = requirement.description;
      description =
        typeof fallbackDescription === "string" && fallbackDescription !== ""
          ? fallbackDescription
          : "Required environment variable";
    }
    return {
      description,
      oneOfGroup,
      vars: group.map(String).join(" + "),
    };
  });
};

const addRequirementEntries = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This caller-owned output array is appended to; copying would lose entries collected for subsequent feature requirements.
  entries: EnvVarEntry[],
  requirement: EnvRequirementLike | undefined,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This caller-owned set records deduplication across successive requirements; a copy would allow duplicate checklist entries.
  seen: Set<string>
): void => {
  if (!requirement) {
    return;
  }
  const dedupeKey = JSON.stringify(
    requirement.options
      .map((group) => group.toSorted())
      .toSorted((leftEntry: readonly string[], rightEntry: readonly string[]) =>
        JSON.stringify(leftEntry).localeCompare(JSON.stringify(rightEntry))
      )
  );
  if (seen.has(dedupeKey)) {
    return;
  }

  seen.add(dedupeKey);
  entries.push(...requirementToEntries(requirement));
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
const collectFeatureEntries = (input: EnvChecklistInput): EnvVarEntry[] => {
  const featureItems: EnvVarEntry[] = [];
  const seen = new Set<string>();

  for (const feature of CORE_FEATURE_KEYS) {
    if (!input.coreFeatures[feature]) {
      continue;
    }

    for (const requirement of coreFeatureEnvRequirements[feature] ?? []) {
      addRequirementEntries(featureItems, requirement, seen);
    }
  }

  for (const tool of BUILT_IN_TOOL_KEYS) {
    if (
      tool === "webSearch" ||
      tool === "urlRetrieval" ||
      tool === "deepResearch" ||
      tool === "codeExecution" ||
      !input.builtInTools[tool]
    ) {
      continue;
    }

    addRequirementEntries(featureItems, builtInToolEnvRequirements[tool], seen);
  }

  for (const requirement of input.installableToolEnvRequirements ?? []) {
    addRequirementEntries(featureItems, requirement, seen);
  }

  return featureItems;
};
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/max-statements */

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
export { collectEnvChecklist };
export type { EnvVarEntry };
