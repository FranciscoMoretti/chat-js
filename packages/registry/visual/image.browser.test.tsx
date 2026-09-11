import { page } from "@vitest/browser/context";
import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { GenerateImageRenderer } from "../src/tools/generate-image/renderer";
import "../../../apps/chat/app/globals.css";

test("image tool loading, success, and unavailable states", async () => {
	const container = document.createElement("main");
	container.style.cssText =
		"padding:24px;background:#171717;width:960px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px";
	document.documentElement.classList.add("dark");
	document.body.append(container);
	const style = document.createElement("style");
	style.textContent =
		"* { animation: none !important; transition: none !important; }";
	document.head.append(style);
	const root = createRoot(container);
	const canvas = document.createElement("canvas");
	canvas.width = 300;
	canvas.height = 256;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas unavailable");
	ctx.fillStyle = "#2563eb";
	ctx.fillRect(0, 0, 300, 256);
	const imageUrl = canvas.toDataURL();
	await act(async () =>
		root.render(
			<>
				<GenerateImageRenderer
					tool={{
						toolCallId: "loading",
						state: "input-available",
						input: { prompt: "Blue sky" },
					}}
				/>
				<GenerateImageRenderer
					tool={{
						toolCallId: "success",
						state: "output-available",
						input: { prompt: "Blue sky" },
						output: { imageUrl, prompt: "Blue sky" },
					}}
				/>
				<GenerateImageRenderer
					tool={{
						toolCallId: "missing",
						state: "output-available",
						input: { prompt: "Unavailable" },
						output: {
							imageUrl: "data:image/png;base64,invalid",
							prompt: "Unavailable",
						},
					}}
				/>
			</>,
		),
	);
	try {
		await expect
			.poll(() => container.textContent)
			.toContain("Generated image unavailable");
		await expect
			.poll(() => container.querySelector("img")?.complete)
			.toBe(true);
		await takeSnapshot("image-tool-states");
		await page.screenshot({ element: container });
	} finally {
		await act(async () => root.unmount());
		container.remove();
		style.remove();
	}
});
