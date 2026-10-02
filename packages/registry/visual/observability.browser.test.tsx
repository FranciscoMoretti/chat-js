import { takeSnapshot } from "@uiverify/vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import { Component as Analytics } from "../src/features/vercel-analytics/component";
import { Component as SpeedInsights } from "../src/features/vercel-speed-insights/component";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/chat",
  useSearchParams: () => new URLSearchParams(),
}));

test("layout telemetry leaves every installed/omitted combination visually unchanged", async () => {
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
    await act(() => {
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
    await act(() => root.unmount());
    for (const script of document.head.querySelectorAll(telemetrySelector)) {
      if (!existingScripts.has(script)) {
        script.remove();
      }
    }
    container.remove();
  }
});
