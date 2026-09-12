import { notFound } from "next/navigation";

import { UiPrimitivesVisualFixture } from "@/components/ui/ui-primitives-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const UiPrimitivesVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }

  return <UiPrimitivesVisualFixture />;
};

export default UiPrimitivesVisualFixturePage;
