import { defineDynamic } from "eve/tools";

import { eveImageContext } from "../../lib/eve/image-context";
import { eveToolImageContext } from "../../lib/eve/tool-image-context";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../tools/chatjs/tools";

export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      const images = eveImageContext(context.messages);
      eveToolImageContext.update(() => images);
      return filterEveTools(tools);
    },
  },
});
