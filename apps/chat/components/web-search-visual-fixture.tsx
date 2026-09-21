"use client";

import { ReasonSearchResearchProgress } from "@/components/deep-research-progress";
import { firecrawlResearchUpdates } from "@/components/web-search-visual-fixture-data";

// The registry harness feeds this same fixture to its mocked research-update
// hook, so the real-app render and the harness snapshot compare identical
// content.
const updates = firecrawlResearchUpdates();

export const WebSearchVisualFixture = () => (
  <main
    className="mx-auto w-full max-w-3xl px-4 py-6"
    data-testid="web-search-visual-fixture"
  >
    <div className="flex flex-col gap-3">
      <ReasonSearchResearchProgress updates={updates} />
    </div>
  </main>
);
