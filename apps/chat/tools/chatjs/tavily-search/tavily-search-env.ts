import { z } from "zod";

const environmentSchema = z.object({
  TAVILY_API_KEY: z.string().optional(),
});

const readToolEnvironment = (
  environment: Readonly<NodeJS.ProcessEnv> = process.env
) => environmentSchema.parse(environment);

export { readToolEnvironment };
