import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import React, { act } from "react";
/* oxlint-enable eslint/sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { expect, test } from "vitest";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { GenerateVideoRenderer } from "../src/tools/generate-video/renderer";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act(() =>
    root.render(
      <>
        <GenerateVideoRenderer
          isReadonly
          messageId="video-fixture"
          tool={{ state: "input-streaming", toolCallId: "streaming" }}
        />
        <GenerateVideoRenderer
          isReadonly
          messageId="video-fixture"
          tool={{
            input: { prompt: "Blue sky" },
            state: "input-available",
            toolCallId: "loading",
          }}
        />
        <GenerateVideoRenderer
          isReadonly
          messageId="video-fixture"
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
          isReadonly
          messageId="video-fixture"
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
    expect(container.textContent).toContain("Provider failed");
    await takeSnapshot("video-tool-states");
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act(() => root.unmount());
    container.remove();
    style.remove();
  }
});
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
