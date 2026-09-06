import { defineTool } from "eve/tools";
import { searchAuthorEndpoint } from "../../lib/author-search.server";
import { searchInput } from "../../lib/author-search-contract";

export default defineTool({
	description:
		"Search the configured author search service for relevant pages.",
	inputSchema: searchInput,
	async execute({ query }) {
		return searchAuthorEndpoint(query);
	},
});
