import { notFound } from "next/navigation";

import { WebSearchVisualFixture } from "@/components/web-search-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const WebSearchVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <WebSearchVisualFixture />;
};

export default WebSearchVisualFixturePage;
