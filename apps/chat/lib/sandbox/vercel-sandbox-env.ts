import { z } from "zod";

const environmentSchema = z.object({
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
});

const readSandboxEnvironment = (
  environment: Readonly<NodeJS.ProcessEnv> = process.env
) => environmentSchema.parse(environment);

const imageEnvironmentSchema = z.object({
  VERCEL_SANDBOX_IMAGE_JAVASCRIPT: z.string().nonempty().optional(),
  VERCEL_SANDBOX_IMAGE_PYTHON: z.string().nonempty().optional(),
});

const readSandboxImageEnvironment = (
  environment: Readonly<NodeJS.ProcessEnv> = process.env
) => imageEnvironmentSchema.parse(environment);

export { readSandboxEnvironment, readSandboxImageEnvironment };
