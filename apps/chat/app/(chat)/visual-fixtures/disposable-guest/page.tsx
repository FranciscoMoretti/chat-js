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

export default Page;
