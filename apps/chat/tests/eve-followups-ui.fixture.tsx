import { useState } from "react";
import { createRoot } from "react-dom/client";
import { FollowUpSuggestionsView } from "../components/followup-suggestions-view";

const suggestions = [
  "Can you give an example?",
  "What are the alternatives?",
  "How would I test this?",
];
function Fixture() {
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
}
const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
