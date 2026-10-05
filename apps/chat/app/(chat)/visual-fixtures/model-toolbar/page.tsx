import { notFound } from "next/navigation";
import React from "react";

import { ModelToolbarVisualFixture } from "@/components/model-toolbar-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const ModelToolbarVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <ModelToolbarVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ModelToolbarVisualFixturePage.
export default ModelToolbarVisualFixturePage;
