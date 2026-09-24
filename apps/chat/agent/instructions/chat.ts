import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: `${systemPrompt()}

Use confirm_note when the user asks you to confirm a note. Always let the user approve or reject the request. Never claim a note was confirmed unless the tool result confirms it. This tool does not save a document or perform an external action.`,
      }),
  },
});
