import type { DynamicResolveContext } from "eve";
import { isAccountSession } from "../../lib/eve/session-identity";
import { defineDynamic } from "eve/tools";

import { eveImageContext } from "../../lib/eve/image-context";
import { eveToolImageContext } from "../../lib/eve/tool-image-context";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../chatjs/generated/tools";

export default defineDynamic({
  events: {
    "step.started": (
      _event: unknown,
      context: Readonly<{
        messages: Parameters<typeof eveImageContext>[0];
        session: DynamicResolveContext["session"];
      }>
    ) => {
      if (!isAccountSession(context.session)) {
        return {};
      }
      const images = eveImageContext(context.messages);
      eveToolImageContext.update(() => images);
      return filterEveTools(tools);
    },
  },
});
