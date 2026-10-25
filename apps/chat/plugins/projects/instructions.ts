import type { DynamicResolveContext } from "eve";
import { isGuestSession } from "@/lib/eve/session-identity";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { projectInstructions } from "./instructions-state";

export default defineDynamic({
  events: {
    "turn.started": (_event: unknown, context: DynamicResolveContext) => {
      if (isGuestSession(context.session)) {
        return null;
      }
      const { content } = projectInstructions.get();

      if (content !== null && content !== "") {
        return defineInstructions({
          content: `Project instructions:\n${content}`,
        });
      }
      return null;
    },
  },
});
