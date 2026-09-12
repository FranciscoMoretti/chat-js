import { readFileSync } from "node:fs";

import { builtInGateways } from "../src/registry/gateways";

/** An independently hosted registry with a name, credentials and file layout unknown to the CLI. */
export function externalGatewayFixture() {
  const base = structuredClone(
    builtInGateways.find((item) => item.meta.chatjs.id === "openai-compatible")!
  );
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
          path: "adapter.ts",
          type: "registry:file",
          target: "~/lib/ai/gateway/adapter.ts",
          content: adapter,
        },
      ],
      name: "acme-adapter",
      type: "registry:item",
    },
    root: {
      ...base,
      files: [
        {
          path: "gateway.ts",
          type: "registry:file",
          target: "~/lib/ai/gateway.ts",
          content: 'export { Gateway } from "./gateway/adapter";\n',
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
}
