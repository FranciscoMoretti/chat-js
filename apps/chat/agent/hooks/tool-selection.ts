import { defineHook } from "eve/hooks";
import { frontendToolsSchema } from "../../lib/ai/types";
import { eveTurnTool } from "../../lib/eve/turn-tools";

export default defineHook({
  events: {
    "turn.started": (_event, context) => {
      const supplied = context.session.auth.current?.attributes.selectedTool;
      const selected =
        supplied === undefined ? null : frontendToolsSchema.parse(supplied);
      eveTurnTool.update(() => selected);
    },
  },
});
