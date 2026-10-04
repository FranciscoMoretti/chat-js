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

/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ModelToolbarVisualFixturePage;
/* oxlint-enable import/no-default-export */
