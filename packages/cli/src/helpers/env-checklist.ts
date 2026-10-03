/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { BUILT_IN_TOOL_KEYS, CORE_FEATURE_KEYS } from "../types";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
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
  description?: string;
  options: string[][];
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

interface EnvChecklistInput {
  gateway: Gateway;
  gatewayRequirements?: EnvRequirementLike[];
  coreFeatures: Record<CoreFeatureKey, boolean>;
  builtInTools: Record<BuiltInToolKey, boolean>;
  auth: Record<AuthProvider, boolean>;
  installableToolEnvRequirements?: EnvRequirementLike[];
}

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/**
 * Expand an EnvRequirement into one or more EnvVarEntries, pulling
 * descriptions from the Zod schema.
 */
const requirementToEntries = (
  requirement: EnvRequirementLike
): EnvVarEntry[] => {
  const oneOfGroup =
    requirement.options.length > 1
      ? requirement.options
          .map((group) => group.map(String).join("+"))
          .join("|")
      : undefined;

  return requirement.options.map((group) => {
    const description = group
      .map((variableName) => envDescriptions.get(variableName) ?? variableName)
      .join(", ");

    return {
      description:
        description ||
        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- Empty strings intentionally select the fallback value here; nullish coalescing would preserve an unusable empty value.
        requirement.description ||
        "Required environment variable",
      oneOfGroup,
      vars: group.map(String).join(" + "),
    };
  });
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const addRequirementEntries = (
  entries: EnvVarEntry[],
  requirement: EnvRequirementLike | undefined,
  seen: Set<string>
): void => {
  if (!requirement) {
    return;
  }
  const dedupeKey = JSON.stringify(
    requirement.options
      .map((group) => group.toSorted())
      .toSorted((leftEntry, rightEntry) =>
        JSON.stringify(leftEntry).localeCompare(JSON.stringify(rightEntry))
      )
  );
  if (seen.has(dedupeKey)) {
    return;
  }

  seen.add(dedupeKey);
  entries.push(...requirementToEntries(requirement));
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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

    addRequirementEntries(
      featureItems,
      builtInToolEnvRequirements[
        tool as keyof typeof builtInToolEnvRequirements
      ],
      seen
    );
  }

  for (const requirement of input.installableToolEnvRequirements ?? []) {
    addRequirementEntries(featureItems, requirement, seen);
  }

  return featureItems;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const collectAuthEntries = (input: EnvChecklistInput): EnvVarEntry[] => {
  const authItems: EnvVarEntry[] = [];

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Keys come from the closed auth-provider requirements catalog; this cast retains that mapped key union.
  for (const provider of Object.keys(authEnvRequirements) as AuthProvider[]) {
    if (input.auth[provider]) {
      authItems.push(...requirementToEntries(authEnvRequirements[provider]));
    }
  }

  return authItems;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { collectEnvChecklist };
export type { EnvVarEntry };
