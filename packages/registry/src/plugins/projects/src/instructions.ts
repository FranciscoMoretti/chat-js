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
      content: `Project instructions:\n${content}`,
    });
  }
  return null;
});
