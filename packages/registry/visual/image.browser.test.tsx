import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import React, { act } from "react";
/* oxlint-enable eslint/sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { expect, test } from "vitest";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { GenerateImageRenderer } from "../src/tools/generate-image/renderer";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
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
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act(() =>
    root.render(
      <>
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
          tool={{
            input: { prompt: "Blue sky" },
            state: "input-available",
            toolCallId: "loading",
          }}
        />
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
          tool={{
            input: { prompt: "Blue sky" },
            output: { imageUrl, prompt: "Blue sky" },
            state: "output-available",
            toolCallId: "success",
          }}
        />
        <GenerateImageRenderer
          isReadonly
          messageId="image-fixture"
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
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act(() => button.focus());
    const actions = container.querySelector<HTMLElement>(
      String.raw`.group-focus-within\:opacity-100`
    );
    if (!actions) {
      throw new Error("Image actions missing");
    }
    await expect.poll(() => getComputedStyle(actions).opacity).toBe("1");
    await takeSnapshot("image-tool-states");
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act(() => root.unmount());
    container.remove();
    style.remove();
  }
});
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
