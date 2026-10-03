import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import gatewayPackage from "@chat-js/gateways/package.json";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { GATEWAY_MODEL_DEFAULTS } from "./defaults";
/* oxlint-enable eslint/sort-imports */
import { gatewayMetadata } from "./metadata";

const environment = {
  litellm: [["LITELLM_BASE_URL"]],
  openai: [["OPENAI_API_KEY"]],
  "openai-compatible": [["OPENAI_COMPATIBLE_BASE_URL"]],
  openrouter: [["OPENROUTER_API_KEY"]],
  vercel: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
};

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const builtInGateways = Object.entries(gatewayMetadata).map(
  ([id, metadata]) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Shadcn metadata is an open JSON extension point; preserve third-party fields while inspecting the ChatJS discriminator rather than impose a new stripping schema.
    const name = id as keyof typeof environment;
    let optionalEnv: string[] = [];
    if (id === "litellm") {
      optionalEnv = ["LITELLM_API_KEY"];
    } else if (id === "openai-compatible") {
      optionalEnv = ["OPENAI_COMPATIBLE_API_KEY"];
    }
    return {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      dependencies: [
        `${gatewayPackage.name}@${gatewayPackage.version}`,
        `${metadata.dependency}@${metadata.version}`,
      ],
      files: [
        {
          path: `src/gateways/${id}/gateway.ts`,
          target: "~/lib/ai/gateway.ts",
          type: "registry:file" as const,
        },
      ],
      meta: {
        chatjs: gatewayDefinitionSchema.parse({
          capabilities: {
            image: id !== "openrouter",
            video: metadata.supportsVideo,
          },
          contractVersion: 1,
          defaults: GATEWAY_MODEL_DEFAULTS[name],
          envRequirements: [{ options: environment[name] }],
          id,
          kind: "gateway",
          optionalEnv,
        }),
      },
      name: `${id}-gateway`,
      title: metadata.exportName,
      type: "registry:item" as const,
    };
  }
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
