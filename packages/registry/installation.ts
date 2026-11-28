import { z } from "zod";
import { eveItemIdSchema, eveRegistriesSchema } from "./eve-catalog";
import { agentConfigurationSchema } from "./agent-configuration";

export const authProviders = ["google", "github", "vercel"] as const;
export const authSelectionSchema = z
  .array(z.enum(authProviders))
  .min(1)
  .transform((providers) => [...new Set(providers)]);
export const defaultAuthProviders = [
  "github",
] satisfies (typeof authProviders)[number][];
export const authProviderLabels = {
  google: "Google OAuth",
  github: "GitHub OAuth",
  vercel: "Vercel OAuth",
} satisfies Record<(typeof authProviders)[number], string>;

const NONEMPTY_ADDRESS_LENGTH = 1;
export const registryAddressSchema = z
  .string()
  .trim()
  .min(NONEMPTY_ADDRESS_LENGTH);
export const storageOptionsSchema = z.record(z.string(), z.unknown(), {
  error: "Enter a valid JSON object.",
});
const storageSelectionSchema = z.strictObject({
  options: storageOptionsSchema.default({}),
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
    auth: authSelectionSchema.optional(),
    plugins: z.array(registryAddressSchema).default([]),
    gateway: registryAddressSchema.optional(),
    modelPicker: z.literal("none").optional(),
    storage: storageSelectionSchema.optional(),
    sandbox: registryAddressSchema.optional(),
    tools: z.array(registryAddressSchema).default([]),
  })
  .superRefine((selection, context) => {
    const disabledDefaults = new Set<string>(
      selection.agent?.disabledDefaultTools
    );
    for (const [index, id] of (selection.eve ?? []).entries()) {
      if (disabledDefaults.has(id)) {
        context.addIssue({
          code: "custom",
          path: ["eve", index],
          message: `Remove the disable override before installing ${id}.`,
        });
      }
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

export const composerPickerChoice = (
  selection: Readonly<InstallationSelection>
) => {
  if (selection.modelPicker === "none") {
    return "none";
  }
  return selection.plugins.includes("parallel-responses")
    ? "parallel"
    : "single";
};

export const withComposerPickerChoice = (
  selection: Readonly<InstallationSelection>,
  choice: ReturnType<typeof composerPickerChoice>
): InstallationSelection => {
  const plugins = selection.plugins.filter(
    (id) => id !== "parallel-responses" && id !== "@chatjs/parallel-responses"
  );
  return {
    ...selection,
    modelPicker: choice === "none" ? "none" : undefined,
    plugins:
      choice === "parallel" ? [...plugins, "parallel-responses"] : plugins,
  };
};

// The reference app demonstrates file artifacts with optional viewers.
const demoInstallation = installationSelectionSchema.parse({
  plugins: [
    "image-viewer",
    "video-viewer",
    "streamdown-math",
    "streamdown-mermaid",
    "spreadsheet-viewer",
    "desktop",
    "projects",
    "feedback",
    "parallel-responses",
    "followup-suggestions",
    "search",
    "credits",
    "guest-chat",
    "model-preferences",
    "ai-titles",
    "sharing",
    "mcp",
    "attachment-uploads",
  ],
  gateway: "vercel",
  sandbox: "default",
  storage: { source: "vercel-blob" },
  tools: [
    "generate-image",
    "generate-video",
    "attach-workspace-file",
    "deep-research",
  ],
});
export { demoInstallation, installationSelectionSchema };
export type { InstallationSelection };
