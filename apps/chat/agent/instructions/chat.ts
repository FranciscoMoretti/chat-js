import type { DynamicResolveContext } from "eve";
import {
  isGuestSession,
  GUEST_INSTRUCTIONS,
} from "../../lib/eve/session-policy";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic({
  events: {
    "turn.started": (_event: unknown, context: DynamicResolveContext) =>
      defineInstructions({
        content: isGuestSession(context.session)
          ? GUEST_INSTRUCTIONS
          : systemPrompt(),
      }),
  },
});
