import { defineDynamic, defineTool, toolOutput } from "eve/tools";
import superjson from "superjson";
import { describeEveTool } from "../../lib/eve/adapt-tool";
import { evePlatformResult } from "../../lib/eve/platform-result";
import {
  executeEvePlatformTool,
  getEvePlatformTools,
} from "../../lib/eve/platform-tools";

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      const modelId = context.session.auth.current?.attributes.modelId;
      const selectedModel = typeof modelId === "string" ? modelId : undefined;
      const messages = superjson.stringify(context.messages);
      const definitions: Record<string, ReturnType<typeof defineTool>> = {};
      const tools = getEvePlatformTools({
        selectedModel,
        dataStream: {
          write() {
            throw new Error("Tool description cannot emit progress.");
          },
        },
      });
      for (const [name, tool] of Object.entries(tools)) {
        definitions[name] = defineTool<unknown, unknown>({
          ...(await describeEveTool(tool)),
          execute: (input, toolContext) =>
            executeEvePlatformTool(
              name,
              input,
              toolContext,
              superjson.parse(messages),
              selectedModel
            ),
          toModelOutput: (output: unknown) =>
            toolOutput.json(evePlatformResult.parse(output).output),
        });
      }
      return definitions;
    },
  },
});
