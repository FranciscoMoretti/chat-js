import { notFound } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LayoutPrimitivesVisualFixture } from "@/components/ui/layout-primitives-visual-fixture";
/* oxlint-enable sort-imports */
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const LayoutPrimitivesVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <LayoutPrimitivesVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component LayoutPrimitivesVisualFixturePage.
export default LayoutPrimitivesVisualFixturePage;
