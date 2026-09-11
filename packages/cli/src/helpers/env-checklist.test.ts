import { describe, expect, it } from "bun:test";
import { collectEnvChecklist } from "./env-checklist";

describe("collectEnvChecklist", () => {
	it("uses the LiteLLM base URL as the gateway requirement", () => {
		const entries = collectEnvChecklist({
			gateway: "litellm",
			coreFeatures: {
				attachments: false,
				parallelResponses: true,
				documents: true,
				mcp: false,
				followupSuggestions: false,
			},
			builtInTools: {
				webSearch: false,
				urlRetrieval: false,
				deepResearch: false,
				codeExecution: false,
				imageGeneration: false,
				videoGeneration: false,
			},
			auth: {
				google: false,
				github: true,
				vercel: false,
			},
			installableToolEnvRequirements: [],
		});

		expect(entries.some((entry) => entry.vars === "LITELLM_BASE_URL")).toBe(
			true,
		);
		expect(entries.some((entry) => entry.vars === "LITELLM_API_KEY")).toBe(
			false,
		);
	});

	it("uses selected retrieval credentials without requiring Firecrawl", () => {
		const entries = collectEnvChecklist({
			gateway: "vercel",
			coreFeatures: {
				attachments: false,
				parallelResponses: true,
				documents: true,
				mcp: false,
				followupSuggestions: false,
			},
			builtInTools: {
				webSearch: false,
				urlRetrieval: true,
				deepResearch: false,
				codeExecution: false,
				imageGeneration: false,
				videoGeneration: false,
			},
			auth: {
				google: false,
				github: true,
				vercel: false,
			},
			installableToolEnvRequirements: [
				{
					description: "PAGE_TOKEN",
					options: [["PAGE_TOKEN"]],
				},
			],
		});

		expect(entries.some((entry) => entry.vars === "PAGE_TOKEN")).toBe(true);
		expect(entries.some((entry) => entry.vars.includes("FIRECRAWL"))).toBe(
			false,
		);
	});
});
