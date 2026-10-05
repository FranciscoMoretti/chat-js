import { notFound } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LintControlsVisualFixture } from "@/components/ui/lint-controls-visual-fixture";
/* oxlint-enable sort-imports */
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const LintControlsVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <LintControlsVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component LintControlsVisualFixturePage.
export default LintControlsVisualFixturePage;
