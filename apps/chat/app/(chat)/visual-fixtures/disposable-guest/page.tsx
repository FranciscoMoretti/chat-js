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

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component Page.
export default Page;
