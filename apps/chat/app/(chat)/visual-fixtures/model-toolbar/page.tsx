import { notFound } from "next/navigation";

import { ModelToolbarVisualFixture } from "@/components/model-toolbar-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const ModelToolbarVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <ModelToolbarVisualFixture />;
};

export default ModelToolbarVisualFixturePage;
