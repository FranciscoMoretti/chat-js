import type { DynamicContext } from "eve";
import { isAccountSession } from "../../lib/eve/session-identity";
import { defineDynamic, defineInstructions } from "eve/instructions";

import { eveTurnTool } from "../../lib/eve/turn-tools";
import { selectedEveTools } from "../../lib/eve/selected-tools";

export default defineDynamic((context: DynamicContext) => {
  if (!isAccountSession(context.session)) {
    return null;
  }
  const tools = selectedEveTools(eveTurnTool.get());

  if (tools) {
    return defineInstructions({
      content: `The user selected these tools for this turn: ${tools.join(", ")}. Use the selected capability for their request. If it is unavailable, explain that instead of substituting another capability.`,
    });
  }
  return defineInstructions({
    content:
      "Tool selection is automatic for this turn. Use the tools exposed now; availability can change between turns. Do not infer that a tool is unavailable from an earlier turn's selection or an earlier assistant statement.",
  });
});
