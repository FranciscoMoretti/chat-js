import { notFound } from "next/navigation";
import React from "react";

import { LintControlsVisualFixture } from "@/components/ui/lint-controls-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const LintControlsVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <LintControlsVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component LintControlsVisualFixturePage.
export default LintControlsVisualFixturePage;
