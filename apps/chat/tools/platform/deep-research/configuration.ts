import { config } from "@/lib/config";
import { env } from "@/lib/env";

export type SearchAPI = "firecrawl" | "serpdive" | "tavily" | "none";

export interface DeepResearchRuntimeConfig {
  allow_clarification: boolean;
  compression_model: string;
  compression_model_max_tokens: number;
  final_report_model: string;
  final_report_model_max_tokens: number;
  max_concurrent_research_units: number;
  max_researcher_iterations: number;
  // General Configuration
  max_structured_output_retries: number;

  // MCP server configuration (not yet implemented)
  mcp_config?: {
    url?: string;
    tools?: string[];
    headers?: Record<string, string>;
  };
  mcp_prompt?: string;
  research_model: string;
  research_model_max_tokens: number;

  // Research Configuration
  search_api: SearchAPI;
  search_api_max_queries: number;
  status_update_model: string;
  status_update_model_max_tokens: number;

  // Model Configuration
  summarization_model: string;
  summarization_model_max_tokens: number;
}

function getSearchApi(): SearchAPI {
  if (env.TAVILY_API_KEY) {
    return "tavily";
  }
  if (env.FIRECRAWL_API_KEY) {
    return "firecrawl";
  }
  if (env.SERPDIVE_API_KEY) {
    return "serpdive";
  }
  return "none";
}

export function getDeepResearchConfig(): DeepResearchRuntimeConfig {
  const {
    defaultModel,
    finalReportModel,
    allowClarification,
    maxConcurrentResearchUnits,
    maxSearchQueries,
    maxResearcherIterations,
  } = config.ai.tools.deepResearch;

  return {
    // General Configuration
    max_structured_output_retries: 3,
    allow_clarification: allowClarification,
    max_concurrent_research_units: maxConcurrentResearchUnits,

    // Research Configuration
    search_api: getSearchApi(),
    search_api_max_queries: maxSearchQueries,
    max_researcher_iterations: maxResearcherIterations,

    // Model Configuration - use same model for research/compression/summarization
    summarization_model: defaultModel,
    summarization_model_max_tokens: 4000,
    research_model: defaultModel,
    research_model_max_tokens: 4000,
    compression_model: defaultModel,
    compression_model_max_tokens: 4000,
    final_report_model: finalReportModel,
    final_report_model_max_tokens: 6000,
    status_update_model: defaultModel,
    status_update_model_max_tokens: 4000,
  };
}
