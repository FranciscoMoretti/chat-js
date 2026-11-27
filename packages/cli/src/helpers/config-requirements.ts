import type { AuthProvider, CoreFeatureKey } from "#cli/types";
import type { ReadonlyInput } from "./readonly-input";
import { builtInGateways } from "#cli/registry/gateways";
import { mcpDefinition } from "../../../registry/src/plugins/mcp/manifest";

type EnvVarName = string;

interface EnvRequirement {
  readonly description: string;
  readonly options: readonly (readonly EnvVarName[])[];
}

const gatewayEnvRequirements: Record<string, EnvRequirement[]> =
  Object.fromEntries(
    builtInGateways.map(
      (item: ReadonlyInput<(typeof builtInGateways)[number]>) => [
        item.meta.chatjs.id,
        item.meta.chatjs.envRequirements.map((requirement) => ({
          ...requirement,
          description:
            requirement.description ??
            requirement.options
              .map((option) => option.join(" + "))
              .join(" or "),
        })),
      ]
    )
  );

const coreFeatureEnvRequirements: Partial<
  Record<CoreFeatureKey, EnvRequirement[]>
> = {
  mcp: (mcpDefinition.envRequirements ?? []).map(
    (
      requirement: ReadonlyInput<
        NonNullable<typeof mcpDefinition.envRequirements>[number]
      >
    ) => ({
      ...requirement,
      description:
        requirement.description ??
        requirement.options.map((group) => group.join(" + ")).join(" or "),
    })
  ),
};

const authEnvRequirements: Record<AuthProvider, EnvRequirement> = {
  github: {
    description: "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET",
    options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
  },
  google: {
    description: "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
    options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
  },
  vercel: {
    description: "VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET",
    options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
  },
};

export {
  authEnvRequirements,
  coreFeatureEnvRequirements,
  gatewayEnvRequirements,
};
export type { EnvRequirement };
