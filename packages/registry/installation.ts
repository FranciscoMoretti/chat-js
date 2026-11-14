import { z } from "zod";
import { eveItemIdSchema, eveRegistriesSchema } from "./eve-catalog";
import { agentConfigurationSchema } from "./agent-configuration";

const NONEMPTY_ADDRESS_LENGTH = 1;
const registryAddressSchema = z.string().min(NONEMPTY_ADDRESS_LENGTH);
const storageSelectionSchema = z.strictObject({
  options: z.record(z.string(), z.unknown()).default({}),
  source: registryAddressSchema,
});

/** Registry addresses, not runtime flags. Creation and demo sync use the same input. */
const installationSelectionSchema = z
  .strictObject({
    agent: agentConfigurationSchema.optional(),
    eveRegistries: eveRegistriesSchema.optional(),
    eve: z
      .array(eveItemIdSchema)
      .max(200)
      .transform((items) => [...new Set(items)])
      .optional(),
    plugins: z.array(registryAddressSchema).default([]),
    gateway: registryAddressSchema.optional(),
    storage: storageSelectionSchema.optional(),
    sandbox: registryAddressSchema.optional(),
    tools: z.array(registryAddressSchema).default([]),
  })
  .superRefine((selection, context) => {
    for (const [index, id] of (selection.eve ?? []).entries()) {
      const namespace = id.startsWith("@") ? id.split("/")[0] : undefined;
      if (
        namespace !== undefined &&
        !["@skills", "@chatjs"].includes(namespace) &&
        selection.eveRegistries?.[namespace] === undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["eve", index],
          message: `Configure ${namespace} before selecting its items.`,
        });
      }
    }
  });

type InstallationSelection = z.infer<typeof installationSelectionSchema>;

// Checked-in demo preset preserves the application's installed plugins.
const demoInstallation = installationSelectionSchema.parse({
  plugins: [
    "slack-documents",
    "desktop",
    "projects",
    "feedback",
    "followup-suggestions",
    "search",
    "credits",
    "guest-chat",
    "model-preferences",
    "ai-titles",
    "sharing",
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ],
  gateway: "vercel",
  sandbox: "vercel",
  storage: { source: "vercel-blob" },
  tools: [
    "word-count",
    "get-weather",
    "retrieve-url",
    "generate-image",
    "generate-video",
    "tavily-search",
    "code-execution",
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
