import { z } from "zod";
import { languageModelSchema, modelRoles } from "@/lib/config-models";

const MINIMUM_COUNT = 1;
const MAX_CONCURRENT_UNITS = 20;
const MAX_ITERATIONS = 10;
const MAX_QUERIES = 10;
const DEFAULT_CONCURRENT_UNITS = 2;
const DEFAULT_ITERATIONS = 1;
const DEFAULT_QUERIES = 2;
const configSchema = z
  .strictObject({
    allowClarification: z.boolean().default(true),
    defaultModel: languageModelSchema.default(modelRoles.fast),
    finalReportModel: languageModelSchema.default(modelRoles.smart),
    maxConcurrentResearchUnits: z
      .number()
      .int()
      .min(MINIMUM_COUNT)
      .max(MAX_CONCURRENT_UNITS)
      .default(DEFAULT_CONCURRENT_UNITS),
    maxResearcherIterations: z
      .number()
      .int()
      .min(MINIMUM_COUNT)
      .max(MAX_ITERATIONS)
      .default(DEFAULT_ITERATIONS),
    maxSearchQueries: z
      .number()
      .int()
      .min(MINIMUM_COUNT)
      .max(MAX_QUERIES)
      .default(DEFAULT_QUERIES),
  })
  .prefault({});
export { configSchema };
