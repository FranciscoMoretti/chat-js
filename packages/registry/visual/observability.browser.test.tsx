import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { Component as Analytics } from "../src/features/vercel-analytics/component";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { Component as SpeedInsights } from "../src/features/vercel-speed-insights/component";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: (): string => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
test("layout telemetry leaves every installed/omitted combination visually unchanged", async (): Promise<void> => {
  const container = document.createElement("main");
  container.style.cssText =
    "padding:24px;background:white;color:black;width:500px";
  document.body.append(container);
  const root = createRoot(container);
  const telemetrySelector =
    'script[data-sdkn^="@vercel/analytics"], script[data-sdkn^="@vercel/speed-insights"]';
  const existingScripts = new Set(
    document.head.querySelectorAll(telemetrySelector)
  );
  try {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act((): void => {
      root.render(
        <>
          {[0, 1, 2, 3].map((mask) => (
            <section key={mask} data-testid={`combination-${mask}`}>
              <p>Chat content</p>
              {mask % 2 ? <Analytics /> : null}
              {Math.floor(mask / 2) ? <SpeedInsights /> : null}
            </section>
          ))}
        </>
      );
    });
    for (const section of container.querySelectorAll("section")) {
      expect(section.innerHTML).toBe("<p>Chat content</p>");
    }
    await takeSnapshot("observability-layout-combinations");
    await page.screenshot({
      element: container,
      path: "../uiverify-archive/observability-layout.png",
    });
  } finally {
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
    await act((): void => root.unmount());
    for (const script of document.head.querySelectorAll(telemetrySelector)) {
      if (!existingScripts.has(script)) {
        script.remove();
      }
    }
    container.remove();
  }
});
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/max-statements */
