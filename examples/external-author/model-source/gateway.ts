import { createOpenAI } from "@ai-sdk/openai";

// Author-owned endpoint configuration using the native Responses protocol.
// Construction performs no request and does not fetch a catalog.
export function createModel(modelId: string) {
	return createOpenAI({
		baseURL: process.env.AUTHOR_GATEWAY_URL ?? "https://api.openai.com/v1",
		apiKey: process.env.AUTHOR_GATEWAY_KEY ?? process.env.OPENAI_API_KEY,
	}).responses(modelId);
}
