import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";

import { GenerateVideoRenderer } from "../src/tools/generate-video/renderer";

import "../../../apps/chat/app/globals.css";

test("video tool streaming, loading, player, and error states", async () => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;background:#171717;width:960px;display:grid;grid-template-columns:1fr 1fr;gap:16px";
  document.documentElement.classList.add("dark");
  document.body.append(container);
  const style = document.createElement("style");
  style.textContent =
    "* { animation:none !important;transition:none !important; }";
  document.head.append(style);
  const root = createRoot(container);
  await act(() =>
    root.render(
      <>
        <GenerateVideoRenderer
          tool={{ state: "input-streaming", toolCallId: "streaming" }}
        />
        <GenerateVideoRenderer
          tool={{
            input: { prompt: "Blue sky" },
            state: "input-available",
            toolCallId: "loading",
          }}
        />
        <GenerateVideoRenderer
          tool={{
            input: { prompt: "Blue sky" },
            output: {
              prompt: "Blue sky",
              videoUrl: new URL("fixtures/blue.mp4", import.meta.url).href,
            },
            state: "output-available",
            toolCallId: "success",
          }}
        />
        <GenerateVideoRenderer
          tool={{
            errorText: "Provider failed",
            input: { prompt: "Blue sky" },
            state: "output-error",
            toolCallId: "error",
          }}
        />
      </>
    )
  );
  try {
    const video = container.querySelector("video");
    if (!video) {
      throw new Error("Video player missing");
    }
    await expect.poll(() => video.readyState).toBeGreaterThanOrEqual(2);
    video.pause();
    video.currentTime = 0;
    await expect.poll(() => video.seeking).toBe(false);
    expect(video.controls).toBe(true);
    expect(container.firstElementChild?.textContent).toContain(
      "Preparing prompt"
    );
    expect(container.firstElementChild?.textContent).not.toContain("Couldn");
    expect(container.textContent).toContain("Couldn't generate video");
    await takeSnapshot("video-tool-states");
  } finally {
    await act(() => root.unmount());
    container.remove();
    style.remove();
  }
});
