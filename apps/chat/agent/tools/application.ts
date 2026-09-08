import { defineDynamic, defineTool } from "eve/tools";
import { config } from "../../lib/config";
import { describeEveTool, executeEveTool } from "../../lib/eve/adapt-tool";
import { tools } from "../../tools/chatjs/tools";

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      const messages = context.messages;
      return {
        wordCount: defineTool({
          ...(await describeEveTool(tools.wordCount)),
          execute: (input, toolContext) =>
            executeEveTool(tools.wordCount, input, toolContext, messages),
        }),
        getWeather: defineTool({
          ...(await describeEveTool(tools.getWeather)),
          execute: (input, toolContext) =>
            executeEveTool(tools.getWeather, input, toolContext, messages),
        }),
        ...(config.ai.tools.urlRetrieval.enabled
          ? {
              retrieveUrl: defineTool({
                ...(await describeEveTool(tools.retrieveUrl)),
                execute: (input, toolContext) =>
                  executeEveTool(
                    tools.retrieveUrl,
                    input,
                    toolContext,
                    messages
                  ),
              }),
            }
          : {}),
      };
    },
  },
});
