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

export default ModelToolbarVisualFixturePage;
