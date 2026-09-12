import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import gatewayPackage from "@chat-js/gateways/package.json";

import { GATEWAY_MODEL_DEFAULTS } from "./defaults";
import { gatewayMetadata } from "./metadata";

const environment = {
  litellm: [["LITELLM_BASE_URL"]],
  openai: [["OPENAI_API_KEY"]],
  "openai-compatible": [["OPENAI_COMPATIBLE_BASE_URL"]],
  openrouter: [["OPENROUTER_API_KEY"]],
  vercel: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
};

export const builtInGateways = Object.entries(gatewayMetadata).map(
  ([id, metadata]) => {
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
          type: "registry:file" as const,
          target: "~/lib/ai/gateway.ts",
        },
      ],
      meta: {
        chatjs: gatewayDefinitionSchema.parse({
          kind: "gateway",
          contractVersion: 1,
          id,
          capabilities: {
            image: id !== "openrouter",
            video: metadata.supportsVideo,
          },
          envRequirements: [{ options: environment[name] }],
          optionalEnv,
          defaults: GATEWAY_MODEL_DEFAULTS[name],
        }),
      },
      name: `${id}-gateway`,
      title: metadata.exportName,
      type: "registry:item" as const,
    };
  }
);
