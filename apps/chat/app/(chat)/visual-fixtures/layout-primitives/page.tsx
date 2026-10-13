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

export default LayoutPrimitivesVisualFixturePage;
