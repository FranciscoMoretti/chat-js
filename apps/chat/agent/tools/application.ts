import type { ToolSet } from "ai";
import { defineDynamic, defineTool } from "eve/tools";
import { parse, stringify } from "superjson";

import { installedTools } from "../../lib/ai/installed-tools";
import { config } from "../../lib/config";
import { describeEveTool, executeEveTool } from "../../lib/eve/adapt-tool";
import { isEvePlatformTool } from "../../lib/eve/platform-result";
import { filterEveTools } from "../../lib/eve/turn-tools";

const registeredTools: ToolSet = installedTools;

const getRegisteredTool = (name: string) => {
  if (
    !Object.hasOwn(registeredTools, name) ||
    isEvePlatformTool(name) ||
    (name === "retrieveUrl" && !config.ai.tools.urlRetrieval.enabled)
  ) {
    throw new Error(`Application tool is unavailable: ${name}`);
  }
  return registeredTools[name];
};

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      // Durable callbacks capture only names and JSON, never executable tool definitions.
      const messages = stringify(context.messages);
      const entries = await Promise.all(
        Object.keys(registeredTools)
          .filter(
            (name) =>
              !isEvePlatformTool(name) &&
              (name !== "retrieveUrl" || config.ai.tools.urlRetrieval.enabled)
          )
          .map(async (name) => [
            name,
            defineTool({
              ...(await describeEveTool(getRegisteredTool(name))),
              execute: (input, toolContext) =>
                executeEveTool(
                  getRegisteredTool(name),
                  input,
                  toolContext,
                  parse(messages)
                ),
            }),
          ])
      );
      const definitions: Record<
        string,
        ReturnType<typeof defineTool>
      > = Object.fromEntries(entries);
      return filterEveTools(definitions);
    },
  },
});
