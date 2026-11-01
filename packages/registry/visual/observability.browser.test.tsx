import { renderRoot, unmountRoot } from "@/tests/visual/primitive-mount";
import React from "react";
import { expect, test } from "vitest";
import {
  PathnameContext,
  PathParamsContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Component as Analytics } from "../src/plugins/vercel-analytics/src/component";
import { Component as SpeedInsights } from "../src/plugins/vercel-speed-insights/src/component";
import { createRoot } from "react-dom/client";
import { page } from "vitest/browser";
import { takeSnapshot } from "@uiverify/vitest";

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
    await renderRoot(
      root,
      <PathnameContext value="/chat">
        <PathParamsContext value={{}}>
          <SearchParamsContext value={new URLSearchParams()}>
            {[0, 1, 2, 3].map((mask) => (
              <section key={mask} data-testid={`combination-${mask}`}>
                <p>Chat content</p>
                {mask % 2 ? <Analytics /> : null}
                {Math.floor(mask / 2) ? <SpeedInsights /> : null}
              </section>
            ))}
          </SearchParamsContext>
        </PathParamsContext>
      </PathnameContext>
    );
    for (const section of container.querySelectorAll("section")) {
      expect(section.innerHTML).toBe("<p>Chat content</p>");
    }
    await takeSnapshot("observability-layout-combinations");
    await page.screenshot({
      element: container,
      path: "../uiverify-archive/observability-layout.png",
    });
  } finally {
    await unmountRoot(root);
    for (const script of document.head.querySelectorAll(telemetrySelector)) {
      if (!existingScripts.has(script)) {
        script.remove();
      }
    }
    container.remove();
  }
});
