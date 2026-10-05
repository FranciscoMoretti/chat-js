import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GatewaySelection } from "#cli/registry/gateways";
import { updateEnvironmentExample } from "#cli/utils/environment-example";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import { preflight } from "#cli/utils/preflight";

import type { ReadonlyInput } from "./readonly-input";

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
            return left < right ? KEY_BEFORE : KEY_AFTER;
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
  // oxlint-disable-next-line unicorn/no-null -- Native null means no JSON replacer while the third argument retains existing sorted, two-space model-default source formatting.
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
  generatedRegistrationSource(`import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { Gateway } from "./gateway";

export const gatewayType = ${JSON.stringify(definition.id)} satisfies InstanceType<typeof Gateway>["type"];
export const gatewayModelDefaults = ${serializedDefaults(definition.defaults)} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = ${JSON.stringify(definition.capabilities)};
export const gatewayEnvRequirements = ${JSON.stringify(definition.envRequirements)};
export const gatewayEnvVariables = ${JSON.stringify(gatewayEnvVariables(definition))};
`);

/**
 * Wire the installed gateway; source and dependencies are installed by shadcn.
 * @param destination Project receiving gateway defaults, model snapshot and env keys.
 * @param selection Resolved descriptor with defaults, capabilities and credentials.
 */
export const configureGatewayProvider = async (
  destination: string,
  selection: ReadonlyInput<GatewaySelection>
): Promise<void> => {
  await preflight(destination, [
    "lib/ai/gateway-model-defaults.ts",
    "lib/ai/models.generated.ts",
    ".env.example",
  ]);
  const snapshotPath = path.join(destination, "lib/ai/models.generated.ts");
  const snapshot = await readFile(snapshotPath, "utf-8").catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return "";
      }
      throw error;
    }
  );
  const { definition } = selection;
  await writeFile(
    path.join(destination, "lib/ai/gateway-model-defaults.ts"),
    gatewayDefaultsSource(definition)
  );
  if (
    !snapshot.includes(`generatedForGateway = ${JSON.stringify(definition.id)}`)
  ) {
    await writeFile(
      snapshotPath,
      generatedRegistrationSource(`import type { AiGatewayModel } from "@chat-js/gateways/models";

export const generatedForGateway = ${JSON.stringify(definition.id)};
// Populate this gateway's catalog with the fetch:models script after setting credentials.
export const models: readonly AiGatewayModel[] = [];
`)
    );
  }
  await updateEnvironmentExample(destination, "gateway-provider", [
    ...definition.envRequirements.flatMap((requirement) =>
      requirement.options.flat()
    ),
    ...definition.optionalEnv,
  ]);
};
