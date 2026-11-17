import { sandboxDefinitionSchema } from "../../sandbox-definition";
import registryPackage from "../../package.json";

export const builtInSandboxes = [
  {
    id: "default",
    title: "Automatic",
    description:
      "EVE selects Vercel on Vercel, Docker when available, or a simulated shell in development.",
  },
  {
    id: "vercel",
    title: "Vercel Sandbox",
    description: "Hosted sandbox with native Python and Node processes.",
  },
  {
    id: "docker",
    title: "Docker",
    description:
      "Containers on a reachable Docker host, with native Python and Node processes.",
  },
  {
    id: "just-bash",
    title: "just-bash",
    description:
      "Simulated shell and filesystem. Cannot run native Python or Node processes.",
  },
].map(({ id, title, description }) => ({
  name: `${id}-sandbox`,
  title,
  description,
  type: "registry:item" as const,
  dependencies: [`eve@${registryPackage.devDependencies.eve}`],
  files: [
    {
      path: `src/sandboxes/${id}/sandbox.ts`,
      target: "~/agent/sandbox.ts",
      type: "registry:file" as const,
    },
  ],
  meta: {
    chatjs: sandboxDefinitionSchema.parse({
      contractVersion: 1,
      kind: "sandbox",
      id,
      capabilities: {
        persistent: true,
        runtimes: id === "just-bash" ? [] : ["python", "javascript"],
        cleanup: "eve-session",
        cancellation: "eve",
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
          : [],
    }),
  },
}));
