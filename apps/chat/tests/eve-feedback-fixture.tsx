import { createRoot } from "react-dom/client";

import { MessageActions } from "../components/ai-elements/message";
import { MessageVoteActions } from "../components/message-vote-actions";

const states: {
  label: string;
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
}[] = [
  { label: "Not rated" },
  { label: "Upvoted", vote: { isUpvoted: true } },
  { label: "Downvoted", vote: { isUpvoted: false } },
  { label: "Loading or saving", disabled: true },
];
const root = document.getElementById("fixture");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  <main className="mx-auto max-w-xl space-y-6 p-6">
    <h1>Shared ChatJS feedback controls</h1>
    {states.map((state) => (
      <section className="space-y-2" key={state.label}>
        <h2>{state.label}</h2>
        <MessageActions>
          <MessageVoteActions
            disabled={state.disabled}
            onVote={async () => undefined}
            vote={state.vote}
          />
        </MessageActions>
      </section>
    ))}
  </main>
);
