import { z } from "zod";

/** Registry addresses, not runtime flags. Creation and demo sync use the same input. */
export const installationSelectionSchema = z.strictObject({
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
export type InstallationSelection = z.infer<typeof installationSelectionSchema>;

// Only implementations available today. C adds uploads/observability after D/E
// publish their registry items; the demo's existing runtime behavior stays intact.
export const demoInstallation = installationSelectionSchema.parse({
  features: ["mcp"],
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
