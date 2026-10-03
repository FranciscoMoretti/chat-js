import { notFound } from "next/navigation";
import React from "react";

import { LintControlsVisualFixture } from "@/components/ui/lint-controls-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- LintControlsVisualFixturePage: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const LintControlsVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <LintControlsVisualFixture />;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default LintControlsVisualFixturePage;
/* oxlint-enable import/no-default-export */
