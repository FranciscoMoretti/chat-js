import { sandboxDefinitionSchema } from "@chat-js/sandboxes/definition";
import sandboxPackage from "@chat-js/sandboxes/package.json";
import registryPackage from "../../package.json";

export const builtInSandboxes = ["vercel", "daytona"].map((id) => ({
  name: `${id}-sandbox`,
  title: id === "vercel" ? "Vercel Sandbox" : "Daytona",
  type: "registry:item" as const,
  dependencies: [
    `${sandboxPackage.name}@${sandboxPackage.version}`,
    ...(id === "vercel"
      ? [
          `@vercel/sandbox@${registryPackage.devDependencies["@vercel/sandbox"]}`,
          `@vercel/oidc@${registryPackage.devDependencies["@vercel/oidc"]}`,
        ]
      : [`@daytona/sdk@${registryPackage.devDependencies["@daytona/sdk"]}`]),
  ],
  files: ["provider.ts", "adapter.ts"].map((file) => ({
    path: `src/sandboxes/${id}/${file}`,
    target: `~/lib/sandbox/${file}`,
    type: "registry:file" as const,
  })),
  meta: {
    chatjs: sandboxDefinitionSchema.parse({
      contractVersion: 1,
      kind: "sandbox",
      id,
      capabilities: {
        runtimes: ["python", "javascript"],
        cleanup: "durable-allocation",
        cancellation: "terminate",
      },
      envRequirements:
        id === "vercel"
          ? [
              {
                options: [
                  ["VERCEL_OIDC_TOKEN"],
                  ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
                ],
                runtimeAuth: "vercel-oidc",
              },
            ]
          : [{ options: [["DAYTONA_API_KEY", "DAYTONA_ORGANIZATION_ID"]] }],
    }),
  },
}));
