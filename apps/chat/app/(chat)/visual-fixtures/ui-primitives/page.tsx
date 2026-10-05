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

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component UiPrimitivesVisualFixturePage.
export default UiPrimitivesVisualFixturePage;
