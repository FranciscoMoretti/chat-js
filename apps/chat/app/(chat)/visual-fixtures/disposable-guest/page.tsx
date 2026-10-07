import { notFound } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { GuestVisualFixture } from "@/tests/eve-disposable-guest.fixture";
/* oxlint-enable sort-imports */

const Page = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <GuestVisualFixture />;
};

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component Page.
export default Page;
