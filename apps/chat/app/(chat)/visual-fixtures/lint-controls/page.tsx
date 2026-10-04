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

/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default LintControlsVisualFixturePage;
/* oxlint-enable import/no-default-export */
