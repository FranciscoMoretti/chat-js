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

export default LintControlsVisualFixturePage;
