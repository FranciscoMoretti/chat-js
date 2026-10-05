import type { RegistryItem } from "shadcn/schema";

// oxlint-disable-next-line import/no-relative-parent-imports -- The registry catalog imports its package-local descriptor schema; the inherited @/ alias resolves app code and cannot address packages/registry/metadata.ts.
import { featureDefinitionSchema } from "../../metadata";

export const observabilityItems = [
  {
    dependencies: ["@vercel/analytics@^1.5.0"],
    description: "Vercel Web Analytics",
    files: ["component.tsx"],
    id: "vercel-analytics",
  },
  {
    dependencies: ["@vercel/speed-insights@^1.3.1"],
    description: "Vercel Speed Insights",
    files: ["component.tsx"],
    id: "vercel-speed-insights",
  },
  {
    dependencies: ["@vercel/otel@^2.1.0", "langfuse-vercel@^3.37.0"],
    description: "Langfuse tracing through Vercel OpenTelemetry",
    envRequirements: [
      { options: [["LANGFUSE_PUBLIC_KEY", "LANGFUSE_SECRET_KEY"]] },
    ],
    files: ["instrumentation.ts", "credentials.ts"],
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
      path: `src/features/${id}/${file}`,
      target: `~/features/${id}/${file}`,
      type: "registry:file" as const,
    })),
    meta: {
      chatjs: featureDefinitionSchema.parse({
        contractVersion: 1,
        id,
        kind: "feature",
        ...definition,
      }),
    },
    name: id,
    type: "registry:item" as const,
  })
) satisfies RegistryItem[];
