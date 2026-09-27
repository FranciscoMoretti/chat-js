import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { CodeExecution } from "../src/tools/vercel-code-execution/renderer";

import "../../../apps/chat/tests/visual/sandbox.css";

test("sandbox code updates while streaming without switching tabs", async () => {
  document.documentElement.classList.add("dark");
  const container = document.createElement("main");
  container.style.cssText = "padding:24px;background:#171717;width:900px";
  document.body.append(container);
  const root = createRoot(container);
  const render = async (
    code: string,
    state: "input-streaming" | "output-available"
  ) => {
    await act(() =>
      root.render(
        <CodeExecution
          isReadonly={false}
          messageId="sandbox-stream"
          tool={{
            input: {
              code,
              language: "python",
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
  await render("print(53 * 41244)", "input-streaming");
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
