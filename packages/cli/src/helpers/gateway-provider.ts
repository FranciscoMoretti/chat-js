import { mkdir, writeFile } from "node:fs/promises";
import type { GatewaySelection } from "#cli/registry/gateways";
import type { ReadonlyInput } from "./readonly-input";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import path from "node:path";
import { preflight } from "#cli/utils/preflight";
import { updateEnvironmentExample } from "#cli/utils/environment-example";

const JSON_INDENTATION_SPACES = 2;
const KEYS_EQUAL = 0;
const KEY_BEFORE = -1;
const KEY_AFTER = 1;

const sortJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((nestedValue: unknown) => sortJsonKeys(nestedValue));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(
          (
            [left]: readonly [string, unknown],
            [right]: readonly [string, unknown]
          ) => {
            if (left === right) {
              return KEYS_EQUAL;
            }
            if (left < right) {
              return KEY_BEFORE;
            }
            return KEY_AFTER;
          }
        )
        .map(([key, nestedValue]: readonly [string, unknown]) => [
          key,
          sortJsonKeys(nestedValue),
        ])
    );
  }
  return value;
};

const serializedDefaults = (
  value: unknown
): ReturnType<typeof JSON.stringify> =>
  JSON.stringify(sortJsonKeys(value), null, JSON_INDENTATION_SPACES);

const gatewayEnvVariables = (
  definition: ReadonlyInput<GatewaySelection["definition"]>
): string[] => {
  const required = definition.envRequirements.flatMap(
    (
      requirement: ReadonlyInput<
        GatewaySelection["definition"]["envRequirements"][number]
      >
    ) => requirement.options.flat()
  );
  return [...new Set([...required, ...definition.optionalEnv])];
};

const gatewayDefaultsSource = (
  definition: ReadonlyInput<GatewaySelection["definition"]>
): string =>
  generatedRegistrationSource(`import type { GatewayModelDefaults } from "@/chatjs/core/gateway/defaults";
import type { Gateway } from "@/chatjs/providers/gateway";

export const gatewayType = ${JSON.stringify(definition.id)} satisfies InstanceType<typeof Gateway>["type"];
export const gatewayModelDefaults = ${serializedDefaults(definition.defaults)} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = ${JSON.stringify(definition.capabilities)};
export const gatewayEnvRequirements = ${JSON.stringify(definition.envRequirements)};
export const gatewayEnvVariables = ${JSON.stringify(gatewayEnvVariables(definition))};
`);

export const gatewayConfigurationTargets = [
  "chatjs/providers/gateway-defaults.ts",
  ".env.example",
];

/**
 * Wire the installed gateway; source and dependencies are installed by shadcn.
 * @param {string} destination Project receiving gateway defaults and env keys.
 * @param {ReadonlyInput<GatewaySelection>} selection Resolved descriptor with defaults, capabilities and credentials.
 */
export const configureGatewayProvider = async (
  destination: string,
  selection: ReadonlyInput<GatewaySelection>
): Promise<void> => {
  await preflight(destination, gatewayConfigurationTargets);
  await mkdir(path.join(destination, "chatjs/providers"), { recursive: true });
  const { definition } = selection;
  await writeFile(
    path.join(destination, "chatjs/providers/gateway-defaults.ts"),
    gatewayDefaultsSource(definition)
  );
  await updateEnvironmentExample(destination, "gateway-provider", [
    ...definition.envRequirements.flatMap((requirement) =>
      requirement.options.flat()
    ),
    ...definition.optionalEnv,
  ]);
};
