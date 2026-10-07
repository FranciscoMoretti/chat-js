import { z } from "zod";

const NONEMPTY_ADDRESS_LENGTH = 1;
const registryAddressSchema = z.string().min(NONEMPTY_ADDRESS_LENGTH);
const storageSelectionSchema = z.strictObject({
  options: z.record(z.string(), z.unknown()).default({}),
  source: registryAddressSchema,
});

/** Registry addresses, not runtime flags. Creation and demo sync use the same input. */
const installationSelectionSchema = z.strictObject({
  features: z.array(registryAddressSchema).default([]),
  gateway: registryAddressSchema.optional(),
  storage: storageSelectionSchema.optional(),
  tools: z.array(registryAddressSchema).default([]),
});

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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (demoInstallation, installationSelectionSchema); the enabled import/no-default-export convention rejects the default-export alternative. */
export { demoInstallation, installationSelectionSchema };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (InstallationSelection); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { InstallationSelection };
/* oxlint-enable import/no-named-export */
