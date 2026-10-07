import { config } from "@/lib/config";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getDeepResearchConfig); the enabled import/no-default-export convention rejects the default-export alternative. */
export const getDeepResearchConfig = (): {
  allow_clarification: typeof config.ai.tools.deepResearch.allowClarification;
  compression_model: typeof config.ai.tools.deepResearch.defaultModel;
  final_report_model: typeof config.ai.tools.deepResearch.finalReportModel;
  max_concurrent_research_units: typeof config.ai.tools.deepResearch.maxConcurrentResearchUnits;
  max_researcher_iterations: typeof config.ai.tools.deepResearch.maxResearcherIterations;
  research_model: typeof config.ai.tools.deepResearch.defaultModel;
  search_api_max_queries: typeof config.ai.tools.deepResearch.maxSearchQueries;
} => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
