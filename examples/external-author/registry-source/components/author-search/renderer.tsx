"use client";

import type { SearchResults } from "../../lib/author-search-contract";

export default function SearchRenderer({ output }: { output: SearchResults }) {
	if (!output.results.length) return <p>No search results.</p>;
	return (
		<ol aria-label="Search results">
			{output.results.map((result, index) => (
				<li key={`${index}-${result.url}`}>
					<a href={result.url} target="_blank" rel="noopener noreferrer">
						{result.title}
					</a>
					<p>{result.snippet}</p>
				</li>
			))}
		</ol>
	);
}
