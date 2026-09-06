import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// This module is installed only on the server. Construction does not fetch a
// catalog or require a credential at import time.
export function createModel(modelId: string) {
	const provider = createOpenAICompatible({
		// Intentionally unlisted identity: this is a negative metadata fixture.
		name: "author-gateway",
		baseURL: process.env.AUTHOR_GATEWAY_URL ?? "https://api.openai.com/v1",
		apiKey: process.env.AUTHOR_GATEWAY_KEY ?? process.env.OPENAI_API_KEY,
	});
	return provider(modelId);
}
