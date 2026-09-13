import type { ToolSet } from "ai";
import { defineDynamic, defineTool } from "eve/tools";
import superjson from "superjson";

import { config } from "../../lib/config";
import { describeEveTool, executeEveTool } from "../../lib/eve/adapt-tool";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../tools/chatjs/tools";

const registeredTools: ToolSet = tools;

function getRegisteredTool(name: string) {
  if (
    !Object.hasOwn(registeredTools, name) ||
    (name === "retrieveUrl" && !config.ai.tools.urlRetrieval.enabled)
  ) {
    throw new Error(`Application tool is unavailable: ${name}`);
  }
  return registeredTools[name];
}

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      // Durable callbacks capture only names and JSON, never executable tool definitions.
      const messages = superjson.stringify(context.messages);
      const definitions: Record<string, ReturnType<typeof defineTool>> = {};
      for (const name of Object.keys(registeredTools)) {
        if (name === "retrieveUrl" && !config.ai.tools.urlRetrieval.enabled) {
          continue;
        }
        definitions[name] = defineTool({
          ...(await describeEveTool(getRegisteredTool(name))),
          execute: (input, toolContext) =>
            executeEveTool(
              getRegisteredTool(name),
              input,
              toolContext,
              superjson.parse(messages)
            ),
        });
      }
      return filterEveTools(definitions);
    },
  },
});
