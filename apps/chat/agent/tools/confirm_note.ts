/* oxlint-disable unicorn/filename-case -- EVE uses the filename as the public tool name. */
import { defineDynamic, defineTool } from "eve/tools";
import { always } from "eve/tools/approval";

import { noteInput } from "../../lib/eve/contracts";
import { filterEveTools } from "../../lib/eve/turn-tools";

const confirmNote = defineTool({
  approval: {
    request: always(),
    response: ({ responder, session }) =>
      responder.principalId === session.initiator?.principalId
        ? { status: "allowed" }
        : { reason: "Only the owner may respond", status: "rejected" },
  },
  description:
    "Confirm a short note after explicit human approval. No external side effects.",
  execute: ({ note }) => Promise.resolve({ confirmed: true, note }),
  inputSchema: noteInput,
});

export default defineDynamic({
  events: {
    "step.started": () => filterEveTools({ confirm_note: confirmNote }),
  },
});
