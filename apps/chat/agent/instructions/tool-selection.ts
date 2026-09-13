import { defineDynamic, defineInstructions } from "eve/instructions";

import { selectedEveTools } from "../../lib/eve/selected-tools";
import { eveTurnTool } from "../../lib/eve/turn-tools";

export default defineDynamic({
  events: {
    "turn.started": () => {
      const tools = selectedEveTools(eveTurnTool.get());
      return tools
        ? defineInstructions({
            content: `The user selected these tools for this turn: ${tools.join(", ")}. Use the selected capability for their request. If it is unavailable, explain that instead of substituting another capability.`,
          })
        : defineInstructions({
            content:
              "Tool selection is automatic for this turn. Use the tools exposed now; availability can change between turns. Do not infer that a tool is unavailable from an earlier turn's selection or an earlier assistant statement.",
          });
    },
  },
});
