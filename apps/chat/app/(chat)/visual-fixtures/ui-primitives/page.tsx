import { notFound } from "next/navigation";
import React from "react";

import { UiPrimitivesVisualFixture } from "@/components/ui/ui-primitives-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const UiPrimitivesVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <UiPrimitivesVisualFixture />;
};

/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default UiPrimitivesVisualFixturePage;
/* oxlint-enable import/no-default-export */
