import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { boundary } from "./api.server";

// Browser skill absent; regular Playwright drives a disposable proof page.
test("browser lazy editor, exact revision selection, and preserved stale draft", async () => {
	const root = await mkdtemp(join(tmpdir(), "revision-browser-"));
	const api = boundary(
		join(root, "documents.db"),
		join(root, "bytes"),
		join(root, "files.db"),
	);
	const first = api.store.create("alice", "Notes", "original text");
	const build = await Bun.build({
		entrypoints: [join(import.meta.dir, "ui.tsx")],
		target: "browser",
		splitting: true,
		outdir: join(root, "dist"),
	});
	expect(build.success).toBe(true);
	const assets = new Map<string, Blob>();
	for (const output of build.outputs)
		assets.set(`/${output.path.split("/").at(-1)}`, output);
	const requested: string[] = [];
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const path = new URL(request.url).pathname;
			requested.push(path);
			if (path === "/")
				return new Response(
					'<!doctype html><html><head><title>Revision fixture</title></head><body><div id="root"></div><script type="module" src="/ui.js"></script></body></html>',
					{ headers: { "Content-Type": "text/html" } },
				);
			const asset = assets.get(path);
			if (asset)
				return new Response(asset, {
					headers: { "Content-Type": "text/javascript" },
				});
			if (path === "/favicon.ico") return new Response(null, { status: 204 });
			return api.handle(request);
		},
	});
	// Override only if the runner already has a compatible browser installed.
	const browser = await chromium.launch({
		executablePath: process.env.FIXTURE_CHROMIUM,
	});
	try {
		const context = await browser.newContext({
			viewport: { width: 1000, height: 760 },
		});
		await context.addCookies([
			{
				name: "fixture",
				value: api.credentials.alice,
				url: server.url.href,
				httpOnly: true,
			},
		]);
		const page = await context.newPage();
		const errors: string[] = [];
		const warnings: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "warning") warnings.push(message.text());
		});
		page.on("pageerror", (error) => errors.push(error.message));
		const url = new URL(server.url);
		url.search = new URLSearchParams(first.ref).toString();
		await page.goto(url.href);
		await page
			.getByRole("heading", { name: "Revision contract fixture" })
			.waitFor();
		expect(await page.title()).toBe("Revision fixture");
		expect(
			await page.getByLabel("Revision", { exact: true }).textContent(),
		).toBe(first.ref.revisionId);
		await page.getByRole("button", { name: "Open exact revision" }).click();
		await page.getByText("original text", { exact: true }).waitFor();
		const beforeEditor = new Set(requested);
		await page.getByRole("button", { name: "Edit", exact: true }).click();
		await page.getByRole("textbox", { name: "Content" }).waitFor();
		expect(
			requested.some((path) => path.endsWith(".js") && !beforeEditor.has(path)),
		).toBe(true);
		await page
			.getByRole("textbox", { name: "Content" })
			.fill("saved from browser");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await page
			.getByRole("textbox", { name: "Content" })
			.waitFor({ state: "detached" });
		const secondId = await page
			.getByLabel("Revision", { exact: true })
			.textContent();
		expect(secondId).not.toBe(first.ref.revisionId);
		if (!secondId) throw new Error("No committed revision");
		expect(
			api.store.read("alice", {
				documentId: first.ref.documentId,
				revisionId: secondId,
			}).content,
		).toBe("saved from browser");
		await page.goto(url.href);
		await page.getByRole("button", { name: "Open exact revision" }).click();
		await page.getByText("original text", { exact: true }).waitFor();
		await page.getByRole("button", { name: "Edit", exact: true }).click();
		await page
			.getByRole("textbox", { name: "Content" })
			.fill("unsaved stale draft");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await page.getByRole("alert").waitFor();
		expect(
			await page.getByRole("textbox", { name: "Content" }).inputValue(),
		).toBe("unsaved stale draft");
		expect(
			await page.getByLabel("Revision", { exact: true }).textContent(),
		).toBe(first.ref.revisionId);
		expect(errors).toEqual([]);
		expect(warnings).toEqual([]);
		if (process.env.FIXTURE_SCREENSHOT)
			await page.screenshot({
				path: process.env.FIXTURE_SCREENSHOT,
				fullPage: true,
			});
		const deniedContext = await browser.newContext();
		await deniedContext.addCookies([
			{
				name: "fixture",
				value: api.credentials.bob,
				url: server.url.href,
				httpOnly: true,
			},
		]);
		const denied = await deniedContext.newPage();
		await denied.goto(url.href);
		await denied.getByRole("button", { name: "Open exact revision" }).click();
		await denied.getByText("Document unavailable", { exact: true }).waitFor();
		expect(await denied.getByRole("textbox").count()).toBe(0);
		if (process.env.FIXTURE_BROWSER_EVIDENCE)
			await Bun.write(
				process.env.FIXTURE_BROWSER_EVIDENCE,
				JSON.stringify(
					{
						url: server.url.href,
						browser: browser.version(),
						viewport: { width: 1000, height: 760 },
						title: await page.title(),
						noPageErrors: errors.length === 0,
						noConsoleWarnings: warnings.length === 0,
						loadedOnlyOnEdit: requested.filter(
							(path) => path.endsWith(".js") && !beforeEditor.has(path),
						),
						exactRevisionAfterCommit: secondId,
						staleDraftPreserved: await page
							.getByRole("textbox", { name: "Content" })
							.inputValue(),
						otherOwnerDenied: true,
					},
					null,
					2,
				),
			);
	} finally {
		await browser.close();
		await server.stop(true);
		api.close();
		await rm(root, { recursive: true, force: true });
	}
}, 30000);
