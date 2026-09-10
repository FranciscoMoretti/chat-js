import { defineDynamic, defineTool } from "eve/tools";
import superjson from "superjson";
import { config } from "../../lib/config";
import { describeEveTool, executeEveTool } from "../../lib/eve/adapt-tool";
import { tools } from "../../tools/chatjs/tools";

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      // Durable callbacks only capture JSON; multipart history can contain URL and byte objects.
      const messages = superjson.stringify(context.messages);
      return {
        wordCount: defineTool({
          ...(await describeEveTool(tools.wordCount)),
          execute: (input, toolContext) =>
            executeEveTool(
              tools.wordCount,
              input,
              toolContext,
              superjson.parse(messages)
            ),
        }),
        getWeather: defineTool({
          ...(await describeEveTool(tools.getWeather)),
          execute: (input, toolContext) =>
            executeEveTool(
              tools.getWeather,
              input,
              toolContext,
              superjson.parse(messages)
            ),
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
                    superjson.parse(messages)
                  ),
              }),
            }
          : {}),
      };
    },
  },
});
