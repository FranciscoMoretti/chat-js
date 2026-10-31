import type { RegistryItem } from "shadcn/schema";

import { pluginDefinitionSchema } from "../../metadata";

export const observabilityItems = [
  {
    dependencies: ["@vercel/analytics@^1.5.0"],
    description: "Vercel Web Analytics",
    files: ["component.tsx", "client-plugin.ts"],
    id: "vercel-analytics",
  },
  {
    dependencies: ["@vercel/speed-insights@^1.3.1"],
    description: "Vercel Speed Insights",
    files: ["component.tsx", "client-plugin.ts"],
    id: "vercel-speed-insights",
  },
  {
    dependencies: ["@vercel/otel@^2.1.0", "langfuse-vercel@^3.37.0"],
    description: "Langfuse tracing through Vercel OpenTelemetry",
    envRequirements: [
      { options: [["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]] },
    ],
    files: ["instrumentation.ts", "credentials.ts", "server-plugin.ts"],
    id: "langfuse",
  },
].map(
  ({
    id,
    description,
    dependencies,
    files,
    ...definition
  }: Readonly<{
    id: string;
    description: string;
    dependencies: readonly string[];
    files: readonly string[];
    envRequirements?: readonly Readonly<{
      options: readonly (readonly string[])[];
    }>[];
  }>) => ({
    dependencies: [...dependencies],
    description,
    files: files.map((file) => ({
      path: `src/plugins/${id}/src/${file}`,
      target: `~/chatjs/plugins/${id}/${file}`,
      type: "registry:file" as const,
    })),
    meta: {
      chatjs: pluginDefinitionSchema.parse({
        contractVersion: 1,
        id,
        kind: "plugin",
        files: files.map((file) => `chatjs/plugins/${id}/${file}`),
        ...(id === "langfuse"
          ? { server: { export: "langfuse", instrumentation: true } }
          : {
              client: {
                export:
                  id === "vercel-analytics"
                    ? "vercelAnalyticsClient"
                    : "vercelSpeedInsightsClient",
                layout: true,
              },
            }),
        ...definition,
      }),
    },
    name: id,
    type: "registry:item" as const,
  })
) satisfies RegistryItem[];
