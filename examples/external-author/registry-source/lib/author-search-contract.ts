import { z } from "zod";

export const searchInput = z.strictObject({
	query: z.string().trim().min(1).max(300),
});
const resultUrl = z
	.url()
	.max(2048)
	.refine((value) => {
		const url = new URL(value);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			!url.username &&
			!url.password
		);
	}, "Expected an HTTP(S) URL without credentials");

export const searchOutput = z.strictObject({
	results: z
		.array(
			z.strictObject({
				title: z.string().min(1).max(200),
				url: resultUrl,
				snippet: z.string().max(2000),
			}),
		)
		.max(10),
});
export type SearchResults = z.output<typeof searchOutput>;
