import { z } from "zod";

const sandboxDefinitionSchema = z.object({
  contractVersion: z.literal(1),
  kind: z.literal("sandbox"),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  capabilities: z.object({
    persistent: z.boolean().optional(),
    runtimes: z.array(z.enum(["python", "javascript"])),
    cleanup: z.literal("eve-session"),
    cancellation: z.literal("eve"),
  }),
  envRequirements: z
    .array(
      z.object({
        description: z.string().optional(),
        options: z
          .array(z.array(z.string().regex(/^[A-Z_][A-Z0-9_]*$/u)).min(1))
          .min(1),
        runtimeAuth: z.literal("vercel-oidc").optional(),
      })
    )
    .default([]),
});
export { sandboxDefinitionSchema };
