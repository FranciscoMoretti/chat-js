import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic({
  events: {
    "turn.started": () =>
      defineInstructions({
        content: systemPrompt(),
      }),
  },
});
