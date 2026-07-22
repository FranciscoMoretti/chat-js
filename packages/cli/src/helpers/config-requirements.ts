import type {
	AuthProvider,
	BuiltInToolKey,
	CoreFeatureKey,
	Gateway,
} from "../types";

type EnvVarName = string;

export interface EnvRequirement {
	description: string;
	options: EnvVarName[][];
}

export const gatewayEnvRequirements: Record<Gateway, EnvRequirement> = {
	openrouter: {
		options: [["OPENROUTER_API_KEY"]],
		description: "OPENROUTER_API_KEY",
	},
	openai: {
		options: [["OPENAI_API_KEY"]],
		description: "OPENAI_API_KEY",
	},
	vercel: {
		options: [["AI_GATEWAY_API_KEY"], ["VERCEL_OIDC_TOKEN"]],
		description: "AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN",
	},
	"openai-compatible": {
		options: [["OPENAI_COMPATIBLE_BASE_URL", "OPENAI_COMPATIBLE_API_KEY"]],
		description: "OPENAI_COMPATIBLE_BASE_URL + OPENAI_COMPATIBLE_API_KEY",
	},
	litellm: {
		options: [["LITELLM_BASE_URL"]],
		description: "LITELLM_BASE_URL",
	},
};

export const coreFeatureEnvRequirements: Partial<
	Record<CoreFeatureKey, EnvRequirement>
> = {
	mcp: {
		options: [["MCP_ENCRYPTION_KEY"]],
		description: "MCP_ENCRYPTION_KEY",
	},
};

export const builtInToolEnvRequirements: Record<
	BuiltInToolKey,
	EnvRequirement | undefined
> = {
	webSearch: {
		options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"], ["SERPDIVE_API_KEY"]],
		description: "TAVILY_API_KEY, FIRECRAWL_API_KEY or SERPDIVE_API_KEY",
	},
	urlRetrieval: {
		options: [["FIRECRAWL_API_KEY"]],
		description: "FIRECRAWL_API_KEY",
	},
	deepResearch: {
		options: [["TAVILY_API_KEY"], ["FIRECRAWL_API_KEY"], ["SERPDIVE_API_KEY"]],
		description: "TAVILY_API_KEY, FIRECRAWL_API_KEY or SERPDIVE_API_KEY",
	},
	codeExecution: {
		options: [
			["VERCEL_OIDC_TOKEN"],
			["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
		],
		description:
			"VERCEL_OIDC_TOKEN or VERCEL_TEAM_ID + VERCEL_PROJECT_ID + VERCEL_TOKEN",
	},
	imageGeneration: undefined,
	videoGeneration: undefined,
};

export const authEnvRequirements: Record<AuthProvider, EnvRequirement> = {
	google: {
		options: [["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]],
		description: "AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET",
	},
	github: {
		options: [["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"]],
		description: "AUTH_GITHUB_ID + AUTH_GITHUB_SECRET",
	},
	vercel: {
		options: [["VERCEL_APP_CLIENT_ID", "VERCEL_APP_CLIENT_SECRET"]],
		description: "VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET",
	},
};

export const envVarDescriptions: Record<string, string> = {
	AUTH_SECRET: "Secret used to sign auth sessions",
	DATABASE_URL: "Database connection string",
	OPENROUTER_API_KEY: "OpenRouter API key",
	OPENAI_API_KEY: "OpenAI API key",
	AI_GATEWAY_API_KEY: "Vercel AI Gateway API key",
	VERCEL_OIDC_TOKEN: "OIDC token available in Vercel runtime",
	OPENAI_COMPATIBLE_BASE_URL: "Base URL for OpenAI-compatible gateway",
	OPENAI_COMPATIBLE_API_KEY: "API key for OpenAI-compatible gateway",
	LITELLM_BASE_URL: "Base URL for LiteLLM proxy",
	LITELLM_API_KEY: "Optional API key for LiteLLM proxy",
	TAVILY_API_KEY: "Tavily API key for web search",
	FIRECRAWL_API_KEY: "Firecrawl API key for search/retrieval",
	MCP_ENCRYPTION_KEY: "Encryption key for MCP connector secrets",
	VERCEL_TEAM_ID: "Vercel team id for sandbox execution",
	VERCEL_PROJECT_ID: "Vercel project id for sandbox execution",
	VERCEL_TOKEN: "Vercel token for sandbox execution",
	AUTH_GOOGLE_ID: "Google OAuth client id",
	AUTH_GOOGLE_SECRET: "Google OAuth client secret",
	AUTH_GITHUB_ID: "GitHub OAuth client id",
	AUTH_GITHUB_SECRET: "GitHub OAuth client secret",
	VERCEL_APP_CLIENT_ID: "Vercel OAuth client id",
	VERCEL_APP_CLIENT_SECRET: "Vercel OAuth client secret",
};
