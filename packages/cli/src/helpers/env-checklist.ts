import { AUTH_PROVIDERS, CORE_FEATURE_KEYS } from "#cli/types";
import type { AuthProvider, CoreFeatureKey, Gateway } from "#cli/types";
import {
  authEnvRequirements,
  coreFeatureEnvRequirements,
  gatewayEnvRequirements,
} from "./config-requirements";

interface EnvRequirement {
  readonly description?: string;
  readonly options: readonly (readonly string[])[];
}

interface EnvSection {
  readonly title: string;
  readonly requirements: readonly EnvRequirement[];
  readonly hint?: string;
}

interface EnvChecklistInput {
  readonly gateway: Gateway;
  readonly gatewayRequirements?: readonly EnvRequirement[];
  readonly storageRequirements?: readonly EnvRequirement[];
  readonly sandboxRequirements?: readonly EnvRequirement[];
  readonly coreFeatures: Readonly<Record<CoreFeatureKey, boolean>>;
  readonly auth: Readonly<Record<AuthProvider, boolean>>;
  readonly installableToolEnvRequirements?: readonly EnvRequirement[];
}

const firstRequirement = 0;
const singleAlternative = 1;

const uniqueRequirements = (
  requirements: readonly EnvRequirement[],
  seen: Set<string>
): EnvRequirement[] =>
  requirements.filter((requirement) => {
    const key = JSON.stringify(
      requirement.options
        .map((option) => JSON.stringify(option.toSorted()))
        .toSorted()
    );
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

export const collectEnvChecklist = (input: EnvChecklistInput): EnvSection[] => {
  const features = CORE_FEATURE_KEYS.flatMap((feature) =>
    input.coreFeatures[feature]
      ? (coreFeatureEnvRequirements[feature] ?? [])
      : []
  );
  const auth = Object.keys(authEnvRequirements)
    .filter((provider): provider is AuthProvider =>
      AUTH_PROVIDERS.some((candidate) => candidate === provider)
    )
    .flatMap((provider) =>
      input.auth[provider] ? [authEnvRequirements[provider]] : []
    );
  const sections: EnvSection[] = [
    {
      title: "App secrets",
      requirements: [{ options: [["AUTH_SECRET", "EVE_GATEWAY_SECRET"]] }],
      hint: "Run openssl rand -base64 32 twice. Use a different value for each secret.",
    },
    { title: "Database", requirements: [{ options: [["DATABASE_URL"]] }] },
    {
      title: "Model gateway",
      requirements:
        input.gatewayRequirements ??
        gatewayEnvRequirements[input.gateway] ??
        [],
    },
    { title: "File storage", requirements: input.storageRequirements ?? [] },
    { title: "Agent sandbox", requirements: input.sandboxRequirements ?? [] },
    { title: "Sign-in", requirements: auth },
    {
      title: "Selected plugins and tools",
      requirements: [
        ...features,
        ...(input.installableToolEnvRequirements ?? []),
      ],
    },
  ];
  const seen = new Set<string>();
  return sections
    .map((section) => ({
      ...section,
      requirements: uniqueRequirements(section.requirements, seen),
    }))
    .filter(({ requirements }) => requirements.length > 0);
};

export const formatEnvChecklist = (sections: readonly EnvSection[]): string => {
  const blocks = sections.map(({ title, requirements, hint }) => {
    const singleChoice =
      requirements.length === singleAlternative &&
      requirements[firstRequirement].options.length > singleAlternative;
    const lines = requirements.map((requirement) => {
      const { options } = requirement;
      if (options.length === singleAlternative) {
        return options
          .flat()
          .map((name) => `    ${name}`)
          .join("\n");
      }
      const alternatives = options.map((names) =>
        names.map((name) => `      ${name}`).join("\n")
      );
      if (singleChoice) {
        return alternatives.join("\n    or\n");
      }
      const choiceLabel = requirement.description?.trim() ?? "";
      const heading =
        choiceLabel === ""
          ? "    Choose one"
          : `    ${choiceLabel} (choose one)`;
      return [heading, alternatives.join("\n    or\n")].join("\n");
    });
    return [
      `  ${title}${singleChoice ? " (choose one)" : ""}`,
      ...lines,
      ...(hint === undefined ? [] : [`    ${hint}`]),
    ].join("\n");
  });
  return blocks.join("\n\n");
};
