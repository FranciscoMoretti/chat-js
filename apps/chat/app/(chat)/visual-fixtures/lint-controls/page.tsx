import { notFound } from "next/navigation";

import { LintControlsVisualFixture } from "@/components/ui/lint-controls-visual-fixture";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";

const LintControlsVisualFixturePage = () => {
  if (!isPlaywrightTestEnvironment()) {
    notFound();
  }
  return <LintControlsVisualFixture />;
};

export default LintControlsVisualFixturePage;
