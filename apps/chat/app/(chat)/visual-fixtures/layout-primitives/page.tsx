import { notFound } from "next/navigation";
import React from "react";

import { LayoutPrimitivesVisualFixture } from "@/components/ui/layout-primitives-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const LayoutPrimitivesVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <LayoutPrimitivesVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component LayoutPrimitivesVisualFixturePage.
export default LayoutPrimitivesVisualFixturePage;
