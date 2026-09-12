import { defineDynamic, defineTool, toolOutput } from "eve/tools";
import superjson from "superjson";
import { config } from "../../lib/config";
import { evePlatformResult } from "../../lib/eve/platform-result";
import {
  eveResearchInput,
  executeEveResearch,
} from "../../lib/eve/research-tool";
import { eveTurnTool } from "../../lib/eve/turn-tools";

export default defineDynamic({
  events: {
    "step.started": (_event, context) => {
      if (eveTurnTool.get() && eveTurnTool.get() !== "deepResearch") {
        return {};
      }
      if (
        !(
          config.ai.tools.deepResearch.enabled &&
          config.ai.tools.documents.enabled &&
          config.ai.tools.documents.types.text
        )
      ) {
        return {};
      }
      const messages = superjson.stringify(context.messages);
      return {
        deepResearch: defineTool<unknown, unknown>({
          description:
            "Conduct deep research using this conversation, search sources, and save a cited report. Use for explicit deep research requests. If the result asks clarifying questions, ask the user and call this tool again after their answer. The saved report is displayed to the user; do not repeat it in full.",
          inputSchema: eveResearchInput,
          execute: (input, toolContext) =>
            executeEveResearch(input, toolContext, superjson.parse(messages)),
          toModelOutput: (output) =>
            toolOutput.json(evePlatformResult.parse(output).output),
        }),
      };
    },
  },
});
