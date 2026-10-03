import { config } from "@/lib/config";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
export const getDeepResearchConfig = () => {
  const options = config.ai.tools.deepResearch;
  return {
    allow_clarification: options.allowClarification,
    compression_model: options.defaultModel,
    final_report_model: options.finalReportModel,
    max_concurrent_research_units: options.maxConcurrentResearchUnits,
    max_researcher_iterations: options.maxResearcherIterations,
    research_model: options.defaultModel,
    search_api_max_queries: options.maxSearchQueries,
  };
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
