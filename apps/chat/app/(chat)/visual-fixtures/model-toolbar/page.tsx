import { notFound } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelToolbarVisualFixture } from "@/components/model-toolbar-visual-fixture";
/* oxlint-enable sort-imports */
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const ModelToolbarVisualFixturePage = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <ModelToolbarVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ModelToolbarVisualFixturePage.
export default ModelToolbarVisualFixturePage;
