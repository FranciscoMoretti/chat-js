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

/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default LayoutPrimitivesVisualFixturePage;
/* oxlint-enable import/no-default-export */
