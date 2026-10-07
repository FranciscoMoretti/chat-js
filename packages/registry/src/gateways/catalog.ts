import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import gatewayPackage from "@chat-js/gateways/package.json";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { GATEWAY_MODEL_DEFAULTS } from "./defaults";
/* oxlint-enable sort-imports */
import { gatewayMetadata } from "./metadata";

const environment = {
  litellm: [["LITELLM_BASE_URL"]],
  openai: [["OPENAI_API_KEY"]],
  "openai-compatible": [["OPENAI_COMPATIBLE_BASE_URL"]],
  openrouter: [["OPENROUTER_API_KEY"]],
  vercel: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
};

const isGatewayType = (id: string): id is keyof typeof environment =>
  Object.hasOwn(environment, id);

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (builtInGateways); the enabled import/no-default-export convention rejects the default-export alternative. */
export const builtInGateways = Object.entries(gatewayMetadata).map(
  ([id, metadata]: Readonly<
    [string, (typeof gatewayMetadata)[keyof typeof gatewayMetadata]]
  >) => {
    if (!isGatewayType(id)) {
      throw new Error(`Unexpected gateway metadata key: ${id}`);
    }
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
        // oxlint-disable-next-line no-ternary -- Select only the adapters that directly import zod; preserve their explicit installation dependencies.
        ...(id === "openai" || id === "openai-compatible" || id === "openrouter"
          ? ["zod"]
          : []),
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
          defaults: GATEWAY_MODEL_DEFAULTS[id],
          envRequirements: [{ options: environment[id] }],
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
