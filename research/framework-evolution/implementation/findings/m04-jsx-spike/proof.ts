import { strict as assert } from "node:assert";
import { chromium } from "@playwright/test";
import { z } from "zod";

const build = await Bun.build({
	entrypoints: [`${import.meta.dir}/app.tsx`],
	target: "browser",
	define: { "process.env.NODE_ENV": JSON.stringify("development") },
});
assert.equal(build.success, true, String(build.logs));
const bundle = await build.outputs[0].text();
const requestSchema = z.object({
	conversationId: z.string(),
	viewId: z.string(),
	text: z.string(),
	model: z.enum(["fast", "careful"]),
});
const sent: z.infer<typeof requestSchema>[] = [];
const messages = [{ id: "one", text: "Existing shared message" }];
let reads = 0;
// Ephemeral loopback fixture, unrelated to configured Next application servers.
const server = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === "/app.js")
			return new Response(bundle, {
				headers: { "content-type": "text/javascript" },
			});
		if (url.pathname === "/messages") {
			reads++;
			return Response.json(messages);
		}
		if (url.pathname === "/send") {
			const input = requestSchema.parse(await request.json());
			sent.push(input);
			messages.push({ id: String(messages.length + 1), text: input.text });
			return Response.json({ ok: true });
		}
		return new Response(
			'<!doctype html><html lang="en"><meta charset="utf-8"><title>Direct JSX proof</title><div id="root"></div><script type="module" src="/app.js"></script></html>',
			{ headers: { "content-type": "text/html" } },
		);
	},
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
	const page = await browser.newPage();
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(server.url.href);
	const left = page.locator('[data-view="left"]');
	const right = page.locator('[data-view="right"]');
	await left.getByText("Existing shared message").waitFor();
	await right.getByText("Existing shared message").waitFor();
	assert.equal(reads, 1, "mounted consumers must share the query");
	await left.getByLabel("Draft").fill("left draft");
	await right.getByLabel("Draft").fill("right draft");
	await left.getByLabel("Model").selectOption("careful");
	await page
		.getByRole("button", { name: "Toggle picker", exact: true })
		.click();
	assert.equal(await page.getByLabel("Model").count(), 0);
	assert.equal(await left.getByLabel("Draft").inputValue(), "left draft");
	assert.equal(await right.getByLabel("Draft").inputValue(), "right draft");
	await left.getByRole("button", { name: "Send", exact: true }).click();
	await right.getByText("left draft", { exact: true }).waitFor();
	assert.deepEqual(sent[0], {
		conversationId: "shared",
		viewId: "left",
		text: "left draft",
		model: "careful",
	});
	assert.equal(await left.getByLabel("Draft").inputValue(), "");
	assert.equal(await right.getByLabel("Draft").inputValue(), "right draft");
	await right.getByRole("button", { name: "Send", exact: true }).click();
	await left.getByText("right draft", { exact: true }).waitFor();
	assert.equal(sent[1].model, "fast", "view without picker uses typed default");
	await right
		.getByRole("button", { name: "External send", exact: true })
		.click();
	await left.getByText("external submission", { exact: true }).waitFor();
	assert.equal(sent[2].viewId, "right");
	assert.equal(reads, 4, "one shared query refresh for each mutation");
	assert.deepEqual(errors, []);
	console.log(
		JSON.stringify(
			{
				passed: true,
				mountedViews: 2,
				reads,
				submissions: sent,
				pageErrors: errors,
			},
			null,
			2,
		),
	);
} finally {
	await browser.close();
	server.stop(true);
}
