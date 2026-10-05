import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */
import { page } from "vitest/browser";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CodeExecution } from "../src/tools/vercel-code-execution/renderer";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "../../../apps/chat/tests/visual/sandbox.css";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
test("sandbox code updates while streaming without switching tabs", async (): Promise<void> => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  const render = async (
    code: string,
    state: "input-streaming" | "output-available",
    language = "python"
  ): Promise<void> => {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act((): void =>
      root.render(
        <CodeExecution
          isReadonly={false}
          messageId="sandbox-stream"
          tool={{
            input: {
              code,
              language,
              title: "Calculate 53 multiplied by 41244",
            },
            output: { chart: "", message: "2185932" },
            state,
            toolCallId: "sandbox-stream",
          }}
        />
      )
    );
  };
  await render("", "input-streaming");
  await render("print(53 *", "input-streaming");
  await expect
    .poll(() => container.querySelector("pre code")?.textContent)
    .toBe("print(53 *");
  await render("print(53 * 41244)", "input-streaming", "pyth");
  await expect
    .poll(() => container.querySelector("pre code")?.textContent)
    .toBe("print(53 * 41244)");
  await takeSnapshot("streaming-code");
  await render("print(53 * 41244)", "output-available");
  await expect
    .poll(() => container.querySelector("pre code")?.textContent)
    .toBe("print(53 * 41244)");
  await takeSnapshot("completed-code");
  await page.getByRole("tab", { name: "Output" }).click();
  await expect
    .poll(() => container.querySelector("pre code")?.textContent)
    .toBe("2185932");
});
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/max-statements */
