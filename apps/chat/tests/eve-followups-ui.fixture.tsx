/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/followup-suggestions-view" dependency within this package instead of introducing an alias or barrel API.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { FollowUpSuggestionsView } from "../components/followup-suggestions-view";
/* oxlint-enable import/no-relative-parent-imports */

const suggestions = [
  "Can you give an example?",
  "What are the alternatives?",
  "How would I test this?",
];
/* oxlint-disable react-perf/jsx-no-new-array-as-prop, react/jsx-no-literals, react/only-export-components --
 * react-perf/jsx-no-new-array-as-prop (#556): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-no-literals (#549): Fixture owns this fixture copy; replacing literal text requires a localization/content-management contract.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
const Fixture = (): React.JSX.Element => {
  const [selected, setSelected] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <section aria-label="Completed answer">
        <p>A completed assistant response.</p>
        <FollowUpSuggestionsView
          onSelect={setSelected}
          suggestions={suggestions}
        />
      </section>
      <section aria-label="Pending request">
        <p>A pending request disables suggestions.</p>
        <FollowUpSuggestionsView
          disabled
          onSelect={setSelected}
          suggestions={suggestions}
        />
      </section>
      <section aria-label="Unavailable suggestions">
        <p>The answer remains available when suggestions fail.</p>
        <FollowUpSuggestionsView onSelect={setSelected} suggestions={[]} />
      </section>
      <output aria-label="Selected suggestion">{selected}</output>
    </main>
  );
};
/* oxlint-enable react-perf/jsx-no-new-array-as-prop, react/jsx-no-literals, react/only-export-components */
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
