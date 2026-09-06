// Copy into the installed studio app root; run `bun conformance.tsx`.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { renderToStaticMarkup } from "react-dom/server";
import { searchAuthorEndpoint } from "./lib/author-search.server";
import { searchInput, searchOutput } from "./lib/author-search-contract";
import { svgOutput } from "./lib/author-svg-contract";
import { toolRenderer } from "./lib/tool-renderer";

const drawing = {
	title: "Blue circle",
	shapes: [{ kind: "circle", x: 256, y: 256, radius: 80, fill: "blue" }],
};
assert.equal(svgOutput.safeParse(drawing).success, true);
for (const value of [
	{ ...drawing, shapes: [] },
	{ ...drawing, shapes: Array(33).fill(drawing.shapes[0]) },
	{ ...drawing, markup: "<script>alert(1)</script>" },
	{
		...drawing,
		shapes: [{ ...drawing.shapes[0], fill: "url(https://evil.test)" }],
	},
	{
		...drawing,
		shapes: [{ ...drawing.shapes[0], x: Number.POSITIVE_INFINITY }],
	},
	{ ...drawing, shapes: [{ ...drawing.shapes[0], radius: 257 }] },
])
	assert.equal(svgOutput.safeParse(value).success, false);
assert.equal(searchInput.safeParse({ query: " " }).success, false);
assert.equal(searchInput.safeParse({ query: "a".repeat(301) }).success, false);
for (const url of [
	"javascript:alert(1)",
	"https://user:password@example.com",
	"data:text/html,test",
]) {
	assert.equal(
		searchOutput.safeParse({ results: [{ title: "Bad", url, snippet: "" }] })
			.success,
		false,
	);
}

let lazyLoads = 0;
const ValidatedSvg = toolRenderer(svgOutput, async () => {
	lazyLoads += 1;
	return { default: () => <p>Drawing loaded</p> };
});
assert.match(
	renderToStaticMarkup(<ValidatedSvg value={{ markup: "bad" }} />),
	/Tool result unavailable/,
);
assert.equal(lazyLoads, 0);

// Typecheck in the generated app; never invoke this function at runtime.
export function rejectWrongRendererType() {
	const Wrong = ({ output }: { output: { unrelated: number } }) => (
		<p>{output.unrelated}</p>
	);
	// @ts-expect-error A drawing renderer must accept the inferred drawing output.
	return toolRenderer(svgOutput, async () => ({ default: Wrong }));
}

let mode = "success";
let seenAuthorization: string | undefined;
let seenMethod: string | undefined;
let seenBody = "";
let redirectTargetCalls = 0;
const response = {
	results: [
		{
			title: "Guide",
			url: "https://example.com/history",
			snippet: "Tree histories",
		},
	],
};
const server = createServer(async (request, reply) => {
	if (request.url === "/redirect-target") redirectTargetCalls += 1;
	seenAuthorization = request.headers.authorization;
	seenMethod = request.method;
	seenBody = "";
	for await (const chunk of request) seenBody += chunk.toString();
	if (mode === "redirect") {
		reply.writeHead(302, { Location: "/redirect-target" });
		reply.end();
		return;
	}
	reply.setHeader("Content-Type", "application/json");
	if (mode === "error") reply.statusCode = 503;
	reply.end(
		mode === "malformed"
			? "not JSON"
			: mode === "oversized"
				? "x".repeat(65537)
				: mode === "invalid-url"
					? JSON.stringify({
							results: [{ ...response.results[0], url: "javascript:alert(1)" }],
						})
					: JSON.stringify(response),
	);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address !== "string");
const previousEndpoint = process.env.AUTHOR_SEARCH_ENDPOINT;
const previousKey = process.env.AUTHOR_SEARCH_KEY;
process.env.AUTHOR_SEARCH_ENDPOINT = `http://127.0.0.1:${address.port}/search`;
process.env.AUTHOR_SEARCH_KEY = "local-fixture-secret";
try {
	assert.deepEqual(await searchAuthorEndpoint(" trees "), response);
	assert.equal(seenMethod, "POST");
	assert.deepEqual(JSON.parse(seenBody), { query: "trees" });
	assert.equal(seenAuthorization, "Bearer local-fixture-secret");
	for (mode of ["malformed", "oversized", "invalid-url", "error", "redirect"]) {
		await assert.rejects(searchAuthorEndpoint("trees"), (error: unknown) => {
			assert.ok(error instanceof Error);
			assert.equal(
				error.message,
				"Search unavailable: request failed or response was invalid",
			);
			assert.equal(error.message.includes("local-fixture-secret"), false);
			return true;
		});
	}
	assert.equal(redirectTargetCalls, 0);
} finally {
	if (previousEndpoint === undefined) delete process.env.AUTHOR_SEARCH_ENDPOINT;
	else process.env.AUTHOR_SEARCH_ENDPOINT = previousEndpoint;
	if (previousKey === undefined) delete process.env.AUTHOR_SEARCH_KEY;
	else process.env.AUTHOR_SEARCH_KEY = previousKey;
	await new Promise<void>((resolve, reject) => {
		// Stop accepting first: Bun may close the listener when terminating all
		// connections. An already-closed fixture is successful cleanup.
		server.close((error) => {
			if (
				error &&
				!("code" in error && error.code === "ERR_SERVER_NOT_RUNNING")
			) {
				reject(error);
			} else resolve();
		});
		server.closeAllConnections();
	});
}
console.log(
	"PASS author contracts, lazy invalid-output fallback, HTTP success and five HTTP negatives; no live provider claim",
);
