import { config } from "@/lib/config";

export const getDeepResearchConfig = () => {
  const options = config.ai.tools.deepResearch;
  return {
    allow_clarification: options.allowClarification,
    compression_model: options.defaultModel,
    compression_model_max_tokens: 4000,
    final_report_model: options.finalReportModel,
    final_report_model_max_tokens: 6000,
    max_concurrent_research_units: options.maxConcurrentResearchUnits,
    max_researcher_iterations: options.maxResearcherIterations,
    research_model: options.defaultModel,
    research_model_max_tokens: 4000,
    search_api_max_queries: options.maxSearchQueries,
  };
};
