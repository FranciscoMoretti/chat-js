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

// Checked-in demo preset matches the reference app’s installed implementations.
export const demoInstallation = installationSelectionSchema.parse({
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
