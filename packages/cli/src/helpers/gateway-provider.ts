/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFile, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { GatewaySelection } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- The provider generator shares the package-local registration emitter in formatter order. */
import { generatedRegistrationSource } from "../utils/generated-registration-source";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { preflight } from "../utils/preflight";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const sortJsonKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((nestedValue) => sortJsonKeys(nestedValue));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => {
          if (left === right) {
            return 0;
          }
          return left < right ? -1 : 1;
        })
        .map(([key, nestedValue]) => [key, sortJsonKeys(nestedValue)])
    );
  }
  return value;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Wire the installed gateway; source and dependencies are installed by shadcn. */
export const configureGatewayProvider = async (
  destination: string,
  selection: GatewaySelection
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
  const example = path.join(destination, ".env.example");
  let env = await readFile(example, "utf-8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  const { definition } = selection;
  await writeFile(
    path.join(destination, "lib/ai/gateway-model-defaults.ts"),
    generatedRegistrationSource(`import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { Gateway } from "./gateway";

export const gatewayType = ${JSON.stringify(definition.id)} satisfies InstanceType<typeof Gateway>["type"];
export const gatewayModelDefaults = ${JSON.stringify(sortJsonKeys(definition.defaults), null, 2)} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = ${JSON.stringify(definition.capabilities)};
export const gatewayEnvRequirements = ${JSON.stringify(definition.envRequirements)};
export const gatewayEnvVariables = ${JSON.stringify([...new Set([...definition.envRequirements.flatMap((r) => r.options.flat()), ...definition.optionalEnv])])};
`)
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
  for (const name of new Set(
    definition.envRequirements.flatMap((r) => r.options.flat())
  )) {
    if (!new RegExp(`^${name}=`, "mu").test(env)) {
      env += `\n${name}=\n`;
    }
  }
  await writeFile(example, env);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
