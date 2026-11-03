import type { DynamicContext } from "eve";
import { isAccountSession } from "../../lib/eve/session-identity";
import { requireSessionProfile } from "../../lib/eve/session-profile";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { systemPrompt } from "../../lib/ai/prompts";

export default defineDynamic((context: DynamicContext) =>
  defineInstructions({
    content: isAccountSession(context.session)
      ? systemPrompt()
      : requireSessionProfile(context.session).instructions,
  })
);
