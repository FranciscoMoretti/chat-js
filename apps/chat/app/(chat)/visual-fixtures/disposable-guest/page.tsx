import { notFound } from "next/navigation";
import React from "react";

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { GuestVisualFixture } from "@/tests/eve-disposable-guest.fixture";

const Page = (): React.JSX.Element => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <GuestVisualFixture />;
};

/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default Page;
/* oxlint-enable import/no-default-export */
