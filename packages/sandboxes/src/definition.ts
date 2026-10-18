import { z } from "zod";

const sandboxDefinitionSchema = z.object({
  contractVersion: z.literal(1),
  kind: z.literal("sandbox"),
  id: z.string().regex(/^[a-z][a-z0-9-]*$/u),
  capabilities: z.object({
    runtimes: z
      .array(z.enum(["python", "javascript"]))
      .refine(
        (runtimes) =>
          runtimes.includes("python") && runtimes.includes("javascript"),
        "Sandbox contract v1 requires Python and JavaScript."
      ),
    cleanup: z.literal("durable-allocation"),
    cancellation: z.literal("terminate"),
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
type SandboxDefinition = z.infer<typeof sandboxDefinitionSchema>;
export { sandboxDefinitionSchema };
export type { SandboxDefinition };
