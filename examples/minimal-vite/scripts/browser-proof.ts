import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { required } from "../lib/env";
import { tokenFor } from "./identity";

const origin = required("APP_ORIGIN");
const dir = new URL("../evidence/", import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
	viewport: { width: 1280, height: 900 },
});
await context.addCookies([
	{
		name: "chatjs_identity",
		value: await tokenFor("browser-alice"),
		url: origin,
		httpOnly: true,
		sameSite: "Strict",
	},
]);
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
	if (message.type() === "error") errors.push(message.text());
});
page.setDefaultTimeout(90_000);
try {
	if (process.argv[2] === "prepare") {
		await page.goto(origin);
		assert.match(await page.title(), /Vite portability proof/);
		await page
			.getByLabel("Message", { exact: true })
			.fill("Call confirm_note with note exactly VITE_BROWSER_RESTART.");
		await page.getByRole("button", { name: "Send", exact: true }).click();
		await page.getByRole("region", { name: "Pending input" }).waitFor();
		await page.getByRole("button", { name: "Approve", exact: true }).waitFor();
		await page.screenshot({
			path: new URL("browser-pending.png", dir).pathname,
			fullPage: true,
		});
		await writeFile(
			new URL("browser-state.json", dir),
			JSON.stringify({ url: page.url() }),
		);
		assert.equal(errors.length, 0, errors.join("\n"));
		console.log(
			JSON.stringify({
				browser: "chromium",
				url: page.url(),
				renderedPending: true,
				consoleErrors: errors,
			}),
		);
	} else {
		const state = JSON.parse(
			await readFile(new URL("browser-state.json", dir), "utf8"),
		);
		await page.goto(state.url);
		if (process.argv[2] !== "verify") {
			await page.getByRole("region", { name: "Pending input" }).waitFor();
			await page.getByRole("button", { name: "Approve", exact: true }).click();
			await page
				.locator("p.note")
				.filter({ hasText: "VITE_BROWSER_RESTART" })
				.waitFor();
			await page.getByRole("button", { name: "Send", exact: true }).waitFor();
			await page
				.getByLabel("Message", { exact: true })
				.fill("Reply exactly VITE_BROWSER_CONTINUED.");
			await page.getByRole("button", { name: "Send", exact: true }).click();
			await page
				.locator("article.assistant")
				.filter({ hasText: "VITE_BROWSER_CONTINUED" })
				.waitFor();
		}
		await page.getByRole("button", { name: "Reconnect", exact: true }).click();
		await page
			.locator("p.note")
			.filter({ hasText: "VITE_BROWSER_RESTART" })
			.waitFor();
		await page
			.locator("article.assistant")
			.filter({ hasText: "VITE_BROWSER_CONTINUED" })
			.waitFor();
		assert.equal(
			await page
				.locator("p.note")
				.filter({ hasText: "VITE_BROWSER_RESTART" })
				.count(),
			1,
		);
		await page
			.locator("output.status")
			.filter({ hasText: /^ready$/ })
			.waitFor();
		await page.screenshot({
			path: new URL("browser-recovered.png", dir).pathname,
			fullPage: true,
		});
		await page.setViewportSize({ width: 390, height: 844 });
		await page.screenshot({
			path: new URL("browser-mobile.png", dir).pathname,
			fullPage: true,
		});
		assert.equal(errors.length, 0, errors.join("\n"));
		assert.equal(await page.locator("vite-error-overlay").count(), 0);
		console.log(
			JSON.stringify({
				browser: "chromium",
				url: page.url(),
				pendingAfterRestart: process.argv[2] === "resume" ? true : undefined,
				approval: process.argv[2] === "resume" ? true : undefined,
				lazyRenderer: true,
				continuation: true,
				ready: true,
				reconnect: true,
				duplicateResults: false,
				consoleErrors: errors,
			}),
		);
	}
} finally {
	await browser.close();
}
