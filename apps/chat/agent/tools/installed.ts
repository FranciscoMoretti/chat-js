import { defineDynamic } from "eve/tools";
import { stringify } from "superjson";

import { eveToolMessages } from "../../lib/eve/tool-messages";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../tools/chatjs/tools";

export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      eveToolMessages.update(() => stringify(context.messages));
      return filterEveTools(tools);
    },
  },
});
