/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFileSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInGateways } from "../src/registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** An independently hosted registry with a name, credentials and file layout unknown to the CLI. */
export const externalGatewayFixture = () => {
  const openAiCompatibleGateway = builtInGateways.find(
    (item): boolean => item.meta.chatjs.id === "openai-compatible"
  );
  if (!openAiCompatibleGateway) {
    throw new Error("Missing OpenAI-compatible gateway fixture");
  }
  const base = structuredClone(openAiCompatibleGateway);
  const adapter = readFileSync(
    new URL(
      "../../registry/src/gateways/openai-compatible/gateway.ts",
      import.meta.url
    ),
    "utf-8"
  )
    .replaceAll('"openai-compatible"', '"acme"')
    .replaceAll("OPENAI_COMPATIBLE_BASE_URL", "ACME_BASE_URL")
    .replaceAll("OPENAI_COMPATIBLE_API_KEY", "ACME_API_KEY");
  return {
    adapter: {
      files: [
        {
          content: adapter,
          path: "adapter.ts",
          target: "~/lib/ai/gateway/adapter.ts",
          type: "registry:file",
        },
      ],
      name: "acme-adapter",
      type: "registry:item",
    },
    root: {
      ...base,
      files: [
        {
          content: 'export { Gateway } from "./gateway/adapter";\n',
          path: "gateway.ts",
          target: "~/lib/ai/gateway.ts",
          type: "registry:file",
        },
      ],
      meta: {
        chatjs: {
          ...base.meta.chatjs,
          envRequirements: [{ options: [["ACME_BASE_URL", "ACME_API_KEY"]] }],
          id: "acme",
          optionalEnv: [],
        },
      },
      name: "acme-gateway",
      registryDependencies: ["./adapter.json"],
    },
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/prefer-default-export */
