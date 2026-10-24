import { z } from "zod";

const environmentSchema = z.object({
  DAYTONA_API_KEY: z.string().optional(),
  DAYTONA_ORGANIZATION_ID: z.string().optional(),
});

const readSandboxEnvironment = (
  environment: Readonly<NodeJS.ProcessEnv> = process.env
) => environmentSchema.parse(environment);

export { readSandboxEnvironment };
