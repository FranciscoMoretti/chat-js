import { strict as assert } from "node:assert";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(import.meta.dir, "../../../../..");
const route = resolve(root, "apps/chat/app/(chat)/m04-p1-proof");
const base = process.env.M04_APP_URL;
assert(base, "Set M04_APP_URL from bun dev:info --json");
await mkdir(route); // Refuse to overwrite an existing route.
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
	await copyFile(
		resolve(import.meta.dir, "page.tsx"),
		resolve(route, "page.tsx"),
	);
	browser = await chromium.launch({ channel: "chrome", headless: true });
	const page = await browser.newPage({
		viewport: { width: 1600, height: 1000 },
	});
	await page.route("**/react-scan/**", (route) => route.abort());
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(`${base}/api/dev-login`);
	await page.goto(`${base}/`);
	await page.getByRole("textbox").fill("provisional draft survives reload");
	await page.reload();
	await expect(page.getByRole("textbox")).toHaveText(
		"provisional draft survives reload",
	);
	await page.getByRole("textbox").fill("");
	await page.goto(`${base}/m04-p1-proof`);
	const left = page.locator('[data-view="left"]');
	const right = page.locator('[data-view="right"]');
	await left.getByTestId("scope-state").waitFor({ timeout: 30000 });
	await expect(left.getByTestId("scope-state")).toContainText(
		'"cursor":"branch-a"',
	);
	await expect(right.getByTestId("scope-state")).toContainText(
		'"cursor":"branch-b"',
	);
	await left.getByRole("textbox").fill("left unsent");
	await right.getByRole("textbox").fill("right preserved");
	await left
		.getByRole("button", { name: "Choose alternate model", exact: true })
		.click();
	await expect(left.getByTestId("scope-state")).toContainText("gpt-4o-mini");
	await expect(right.getByTestId("scope-state")).toContainText("gpt-5-mini");
	await left.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(left).toContainText("controlled answer 0");
	await expect(right.getByRole("textbox")).toHaveText("right preserved");
	await expect(right).not.toContainText("controlled answer 0");
	await left.getByRole("button", { name: "Select A", exact: true }).click();
	await expect(left).not.toContainText("controlled answer 0");
	await left.getByRole("textbox").fill("main draft survives edit");
	await left
		.getByRole("button", { name: "Edit message", exact: true })
		.first()
		.click();
	await expect(left.getByRole("textbox")).toHaveCount(2);
	await expect(left.getByRole("textbox").last()).toHaveText(
		"main draft survives edit",
	);
	await left.getByRole("textbox").first().fill("edited root");
	await left
		.getByRole("button", { name: "Submit", exact: true })
		.first()
		.click();
	await expect(left).toContainText("controlled answer 1");
	await expect(left.getByRole("textbox")).toHaveText(
		"main draft survives edit",
	);
	await left.getByRole("button", { name: "Select A", exact: true }).click();

	await page.route("**/api/files/content**", (route) =>
		route.fulfill({
			status: 200,
			contentType: "image/png",
			body: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=",
				"base64",
			),
		}),
	);
	const releases: (() => void)[] = [];
	await page.route("**/api/files/upload", async (route) => {
		const index = releases.length;
		await new Promise<void>((resolve) => releases.push(resolve));
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				url: `${base}/api/files/content?key=${String(index).padStart(24, "0")}.png`,
				pathname: `upload-${index}.png`,
				contentType: "image/png",
			}),
		});
	});
	const startUpload = async (name: string) => {
		const request = page.waitForRequest("**/api/files/upload", {
			timeout: 10000,
		});
		await left
			.locator('input[type="file"]')
			.first()
			.setInputFiles({
				name,
				mimeType: "image/png",
				buffer: Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=",
					"base64",
				),
			});
		await request;
	};
	await startUpload("older.png");
	await left.getByRole("button", { name: "Select B", exact: true }).click();
	await left.getByRole("button", { name: "Select A", exact: true }).click();
	await startUpload("newer.png");
	await expect(left.getByTestId("input-attachment-preview")).toHaveCount(2);
	releases[0]();
	await expect(left.getByTestId("input-attachment-preview")).toHaveCount(1);
	await expect(
		left.getByRole("button", { name: "Submit", exact: true }),
	).toBeDisabled();
	await expect(left.getByTestId("scope-state")).toContainText(
		'"attachments":0',
	);
	releases[1]();

	await expect(left.getByTestId("scope-state")).toContainText(
		'"attachments":1',
	);
	await left.getByTestId("input-attachment-preview").hover();
	await left
		.getByRole("button", { name: "Remove attachment", exact: true })
		.click();
	await expect(
		left.getByRole("button", { name: "Submit", exact: true }),
	).toBeEnabled();
	await left
		.getByRole("button", { name: "Open origin document", exact: true })
		.click();
	await left.getByRole("button", { name: "Select B", exact: true }).click();
	await expect(page.getByTestId("artifact")).toContainText("Origin content");
	// Development diagnostic launchers occupy the same corner as the document toolbar.
	await page.addStyleTag({
		content:
			".tsqd-parent-container, #react-scan-root { display:none !important; }",
	});
	await page
		.getByTestId("artifact")
		.getByRole("button", { name: "Add final polish", exact: true })
		.click();
	await expect(page.getByTestId("requests")).toContainText('"parent":');
	await expect(page.getByTestId("requests")).toHaveText(
		/.*"ancestor":"branch-a"[^}]*}\]/,
	);
	await expect(left.getByTestId("scope-state")).toContainText(
		'"cursor":"branch-b"',
	);

	await page.getByTestId("artifact-close-button").click();
	await page.getByRole("button", { name: "Toggle left", exact: true }).click();
	await page.getByRole("button", { name: "Toggle left", exact: true }).click();
	await expect(left.getByTestId("scope-state")).toContainText(
		'"cursor":"branch-b"',
	);
	await expect(left.getByRole("textbox")).toHaveText(
		"main draft survives edit",
	);
	await expect(right.getByRole("textbox")).toHaveText("right preserved");
	assert.deepEqual(errors, []);
	console.log(
		JSON.stringify({
			mountedViews: 2,
			productionMessagesAndComposer: true,
			independentPathsDraftsModels: true,
			editIsolation: true,
			workspaceSurvivesNavigation: true,
			workspaceActionRetainsOrigin: true,
			remountSelectionAndDraft: true,
			provisionalDraftReload: true,
			staleUploadIgnored: true,
			olderUploadCannotClearNewerPendingState: true,
			pageErrors: errors,
		}),
	);
} finally {
	await browser?.close();
	await rm(route, { recursive: true, force: true });
}
