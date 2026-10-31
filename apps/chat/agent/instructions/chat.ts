import type { DynamicResolveContext } from "eve";
import { isAccountSession } from "../../lib/eve/session-identity";
import { requireSessionProfile } from "../../lib/eve/session-profile";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic({
  events: {
    "turn.started": (_event: unknown, context: DynamicResolveContext) =>
      defineInstructions({
        content: isAccountSession(context.session)
          ? systemPrompt()
          : requireSessionProfile(context.session).instructions,
      }),
  },
});
