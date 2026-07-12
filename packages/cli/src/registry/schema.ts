import { z } from "zod";

export const envRequirementSchema = z.object({
  description: z.string().optional(),
  options: z.array(z.array(z.string())),
});

export const projectRequirementSchema = z.enum(["storage"]);

export const registryToolFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  type: z.enum(["tool", "renderer", "lib", "component", "hook", "ui"]),
  target: z.string(),
});

export const registryToolItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  envRequirements: z.array(envRequirementSchema).optional(),
  projectRequirements: z.array(projectRequirementSchema).optional(),
  files: z.array(registryToolFileSchema),
});

export const registryIndexItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  hidden: z.boolean().optional(),
  projectRequirements: z.array(projectRequirementSchema).optional(),
});

export type RegistryToolItem = z.infer<typeof registryToolItemSchema>;
export type RegistryToolItemFile = z.infer<typeof registryToolFileSchema>;
export type EnvRequirement = z.infer<typeof envRequirementSchema>;
export type ProjectRequirement = z.infer<typeof projectRequirementSchema>;
export type RegistryIndexItem = z.infer<typeof registryIndexItemSchema>;
