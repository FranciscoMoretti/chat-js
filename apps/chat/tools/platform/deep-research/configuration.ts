import { config } from "@/lib/config";

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
