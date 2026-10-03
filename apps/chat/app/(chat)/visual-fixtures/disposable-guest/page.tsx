import { notFound } from "next/navigation";
import React from "react";

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { GuestVisualFixture } from "@/tests/eve-disposable-guest.fixture";

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- Page: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

const Page = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <GuestVisualFixture />;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default Page;
/* oxlint-enable import/no-default-export */
