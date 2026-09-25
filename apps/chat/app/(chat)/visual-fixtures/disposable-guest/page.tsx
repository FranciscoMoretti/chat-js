import { notFound } from "next/navigation";

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { GuestVisualFixture } from "@/tests/eve-disposable-guest.fixture";

const Page = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <GuestVisualFixture />;
};
export default Page;
