import { defineDynamic, defineTool, toolOutput } from "eve/tools";
import superjson from "superjson";
import { config } from "../../lib/config";
import { describeEveTool, executeEveTool } from "../../lib/eve/adapt-tool";
import {
  createEvePlatformResult,
  evePlatformResult,
} from "../../lib/eve/platform-result";
import { codeExecution } from "../../tools/platform/code-execution";

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      if (!config.ai.tools.codeExecution.enabled) {
        return null;
      }
      const messages = superjson.stringify(context.messages);
      return {
        codeExecution: defineTool({
          ...(await describeEveTool(codeExecution({}))),
          async *execute(input, toolContext) {
            if (!config.ai.tools.codeExecution.enabled) {
              throw new Error("Code execution is disabled.");
            }
            let costCents = 0;
            const costs = {
              addAPICost: (_name: string, cost: number) => {
                if (!Number.isFinite(cost) || cost < 0) {
                  throw new Error("Invalid platform tool cost.");
                }
                costCents += cost;
              },
            };
            for await (const output of executeEveTool(
              codeExecution({ costAccumulator: costs }),
              input,
              toolContext,
              superjson.parse(messages)
            )) {
              // This tool records only a fixed API charge, in cents.
              yield createEvePlatformResult(output, costCents / 100);
            }
          },
          toModelOutput: (output) =>
            toolOutput.json(evePlatformResult.parse(output).output),
        }),
      };
    },
  },
});
