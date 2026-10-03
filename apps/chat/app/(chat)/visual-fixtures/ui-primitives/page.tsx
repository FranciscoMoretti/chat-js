/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { notFound } from "next/navigation";
import React from "react";

import { UiPrimitivesVisualFixture } from "@/components/ui/ui-primitives-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
/* oxlint-enable sort-imports */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- UiPrimitivesVisualFixturePage: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const UiPrimitivesVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <UiPrimitivesVisualFixture />;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default UiPrimitivesVisualFixturePage;
/* oxlint-enable import/no-default-export */
