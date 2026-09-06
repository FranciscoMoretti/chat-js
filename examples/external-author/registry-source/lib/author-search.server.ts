import {
	type SearchResults,
	searchInput,
	searchOutput,
} from "./author-search-contract";

// Server-owned configuration: the model controls the query, never the endpoint.
export async function searchAuthorEndpoint(
	query: string,
): Promise<SearchResults> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 5000);
	try {
		const endpoint = new URL(process.env.AUTHOR_SEARCH_ENDPOINT ?? "");
		if (
			(endpoint.protocol !== "https:" && endpoint.protocol !== "http:") ||
			endpoint.username ||
			endpoint.password ||
			endpoint.hash ||
			endpoint.search
		)
			throw new Error("Invalid search configuration");
		const key = process.env.AUTHOR_SEARCH_KEY;
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(key ? { Authorization: `Bearer ${key}` } : {}),
			},
			body: JSON.stringify(searchInput.parse({ query })),
			signal: controller.signal,
			redirect: "error",
		});
		if (!response.ok || !response.body) throw new Error("Search failed");
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let size = 0;
		let text = "";
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > 65536) {
					controller.abort();
					throw new Error("Search response too large");
				}
				text += decoder.decode(value, { stream: true });
			}
			text += decoder.decode();
		} finally {
			reader.releaseLock();
		}
		return searchOutput.parse(JSON.parse(text));
	} catch {
		// Do not serialize provider bodies, configuration, keys or URLs into Eve.
		throw new Error(
			"Search unavailable: request failed or response was invalid",
		);
	} finally {
		clearTimeout(timer);
	}
}
