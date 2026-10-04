import { z } from "zod";

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/** Registry addresses, not runtime flags. Creation and demo sync use the same input. */
const installationSelectionSchema = z.strictObject({
  features: z.array(z.string().min(1)).default([]),
  gateway: z.string().min(1).optional(),
  storage: z
    .strictObject({
      options: z.record(z.string(), z.unknown()).default({}),
      source: z.string().min(1),
    })
    .optional(),
  tools: z.array(z.string().min(1)).default([]),
});
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-magic-numbers */

type InstallationSelection = z.infer<typeof installationSelectionSchema>;

// Checked-in demo preset preserves the application's installed features.
const demoInstallation = installationSelectionSchema.parse({
  features: [
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ],
  gateway: "vercel",
  storage: { source: "vercel-blob" },
  tools: [
    "word-count",
    "get-weather",
    "retrieve-url",
    "generate-image",
    "generate-video",
    "tavily-search",
    "vercel-code-execution",
    "text-documents",
    "code-documents",
    "sheet-documents",
    "read-document",
    "delete-document",
    "saved-code-execution",
    "deep-research",
  ],
});
export { demoInstallation, installationSelectionSchema };
export type { InstallationSelection };
