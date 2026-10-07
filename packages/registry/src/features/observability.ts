import type { RegistryItem } from "shadcn/schema";

// oxlint-disable-next-line import/no-relative-parent-imports -- The registry catalog imports its package-local descriptor schema; the inherited @/ alias resolves app code and cannot address packages/registry/metadata.ts.
import { featureDefinitionSchema } from "../../metadata";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (observabilityItems); the enabled import/no-default-export convention rejects the default-export alternative. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding definition excludes id, description, dependencies, files from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...definition,
      }),
    },
    name: id,
    type: "registry:item" as const,
  })
) satisfies RegistryItem[];
/* oxlint-enable import/prefer-default-export, import/no-named-export */
