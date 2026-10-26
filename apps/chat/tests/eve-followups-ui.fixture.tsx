import { MessageScrollerProvider } from "@/components/ui/message-scroller";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { EveMessages } from "../components/eve/eve-messages";

import { FollowUpSuggestionsView } from "../plugins/followup-suggestions/followup-suggestions-view";

const suggestions = [
  "Can you give an example?",
  "What are the alternatives?",
  "How would I test this?",
];
const Fixture = (): React.JSX.Element => {
  const [selected, setSelected] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <section aria-label="Completed answer">
        <MessageScrollerProvider>
          <EveMessages
            messages={[
              {
                id: "completion:assistant",
                role: "assistant",
                parts: [
                  { type: "text", text: "A completed assistant response." },
                ],
              },
            ]}
            isReadonly={false}
            disabled={false}
            respond={() => {
              /* No input requests in this display fixture. */
            }}
            suggestions={
              <FollowUpSuggestionsView
                onSelect={setSelected}
                suggestions={suggestions}
              />
            }
          />
        </MessageScrollerProvider>
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
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
