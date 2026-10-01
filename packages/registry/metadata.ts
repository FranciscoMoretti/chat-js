import { z } from "zod";

const identifier = z
  .string()
  .regex(/^[A-Za-z_$][\w$]*$/u)
  .refine((value) => value !== "__proto__", "Reserved registration name");
export const envRequirementSchema = z.object({
  description: z.string().optional(),
  options: z
    .array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).min(1))
    .min(1),
  runtimeAuth: z.literal("vercel-oidc").optional(),
});
const toolDefinitionBase = z.object({
  availabilityExport: identifier.optional(),
  codeExecutorExport: identifier.optional(),
  documentKind: z.enum(["text", "code", "sheet"]).optional(),
  documentRunExport: identifier.optional(),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("tool"),
  requiresTools: z.array(identifier).default([]),
  slot: z
    .enum([
      "webSearch",
      "codeExecution",
      "retrieveUrl",
      "generateImage",
      "generateVideo",
    ])
    .optional(),
  tools: z
    .array(
      z.object({
        composer: z
          .object({
            icon: z.enum([
              "Edit3",
              "Globe",
              "Hash",
              "Images",
              "Telescope",
              "Video",
              "Wrench",
            ]),
            name: z.string().min(1),
            shortName: z.string().min(1),
          })
          .optional(),
        rendererExport: identifier.optional(),
        toolExport: identifier,
        workflow: z.literal(true).optional(),
      })
    )
    .min(1),
});
// A single native EVE authoring contract. The version validates the descriptor format.
export const toolDefinitionSchema = toolDefinitionBase
  .extend({
    contractVersion: z.literal(1),
  })
  .refine((item) => !item.codeExecutorExport || item.slot === "codeExecution", {
    message:
      "Code executor capabilities apply only to a codeExecution provider",
  })
  .refine((item) => !item.slot || item.tools.every((tool) => !tool.workflow), {
    message: "Provider slots require ordinary native tools",
  })
  .refine((item) => !item.slot || item.tools.length === 1, {
    message: "A provider slot must register exactly one tool",
  });
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;

export const storageDefinitionSchema = z.object({
  configKeys: z.array(z.string()).default([]),
  contractVersion: z.literal(1),
  envRequirements: z.array(envRequirementSchema).default([]),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  kind: z.literal("storage"),
  optionalEnv: z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).default([]),
});
export type StorageDefinition = z.infer<typeof storageDefinitionSchema>;

// Web features currently have one supported implementation. Extend this contract
// when another feature needs registration, rather than accepting unhandled metadata.
export const featureDefinitionSchema = z.object({
  contractVersion: z.literal(1),
  id: z.literal("mcp"),
  kind: z.literal("feature"),
});
