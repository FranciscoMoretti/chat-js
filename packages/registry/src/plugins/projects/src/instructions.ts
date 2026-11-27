import type { DynamicContext } from "eve";
import { isAccountSession } from "@/lib/eve/session-identity";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { projectInstructions } from "./instructions-state";

export default defineDynamic((context: DynamicContext) => {
  if (!isAccountSession(context.session)) {
    return null;
  }
  const { content } = projectInstructions.get();

  if (content !== null && content !== "") {
    return defineInstructions({
      content: `Current project instructions for this turn. Follow these instructions even when a previous assistant reply used different project instructions. Previous assistant replies are conversation history.\n\nProject instructions:\n${content}`,
    });
  }
  return null;
});
