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
  if (!ctx) {
    throw new Error("Canvas unavailable");
  }
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, 0, 300, 256);
  const imageUrl = canvas.toDataURL();
  await act(() =>
    root.render(
      <>
        <GenerateImageRenderer
          tool={{
            input: { prompt: "Blue sky" },
            state: "input-available",
            toolCallId: "loading",
          }}
        />
        <GenerateImageRenderer
          tool={{
            input: { prompt: "Blue sky" },
            output: { imageUrl, prompt: "Blue sky" },
            state: "output-available",
            toolCallId: "success",
          }}
        />
        <GenerateImageRenderer
          tool={{
            input: { prompt: "Unavailable" },
            output: {
              imageUrl: "data:image/png;base64,invalid",
              prompt: "Unavailable",
            },
            state: "output-available",
            toolCallId: "missing",
          }}
        />
      </>
    )
  );
  try {
    await expect
      .poll(() => container.textContent)
      .toContain("Generated image unavailable");
    await expect
      .poll(() => container.querySelector("img")?.complete)
      .toBe(true);
    const button = container.querySelector<HTMLButtonElement>("button");
    if (!button) {
      throw new Error("Image button missing");
    }
    await act(() => button.focus());
    const actions = container.querySelector<HTMLElement>(
      ".group-focus-within\\:opacity-100"
    );
    if (!actions) {
      throw new Error("Image actions missing");
    }
    await expect.poll(() => getComputedStyle(actions).opacity).toBe("1");
    await takeSnapshot("image-tool-states");
  } finally {
    await act(() => root.unmount());
    container.remove();
    style.remove();
  }
});
