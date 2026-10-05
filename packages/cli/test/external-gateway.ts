// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture inspects project files using native filesystem APIs.
import { readFileSync } from "node:fs";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { builtInGateways } from "#cli/registry/gateways";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (externalGatewayFixture); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable sort-imports */

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
