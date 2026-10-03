import type { RegistryItem } from "shadcn/schema";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { featureDefinitionSchema } from "../../metadata";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
].map(({ id, description, dependencies, files, ...definition }) => ({
  dependencies,
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
})) satisfies RegistryItem[];
/* oxlint-enable typescript/prefer-readonly-parameter-types */
