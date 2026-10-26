import React from "react";
import { createRoot } from "react-dom/client";

import { MessageVoteActions } from "../plugins/feedback/message-vote-actions";

const states: {
  label: string;
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
}[] = [
  { label: "Not rated" },
  { label: "Upvoted", vote: { isUpvoted: true } },
  { label: "Downvoted", vote: { isUpvoted: false } },
  { disabled: true, label: "Loading or saving" },
];
const root = document.querySelector("#fixture");
if (!root) {
  throw new Error("Missing fixture root");
}

createRoot(root).render(
  <main className="mx-auto max-w-xl space-y-6 p-6">
    <h1>Shared ChatJS feedback controls</h1>
    {states.map(
      (
        state: Readonly<{
          label: string;
          vote?: Readonly<{ isUpvoted: boolean }>;
          disabled?: boolean;
        }>
      ) => (
        <section className="space-y-2" key={state.label}>
          <h2>{state.label}</h2>
          <div className="flex items-center gap-1">
            <MessageVoteActions
              disabled={state.disabled}
              onVote={async () => {
                /* This static fixture does not submit a vote. */
              }}
              vote={state.vote}
            />
          </div>
        </section>
      )
    )}
  </main>
);
