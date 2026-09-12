import { type ModelMessage, tool } from "ai";
import { Langfuse } from "langfuse";
import { z } from "zod";

import type { StreamWriter } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { generateUUID } from "@/lib/utils";

import type { ToolSession } from "../types";
import { getDeepResearchConfig } from "./configuration";
import { runDeepResearchPipeline } from "./pipeline";

export const deepResearch = ({
  session,
  dataStream,
  messageId,
  messages,
  costAccumulator,
}: {
  session: ToolSession;
  dataStream: StreamWriter;
  messageId: string;
  messages: ModelMessage[];
  costAccumulator: CostAccumulator;
}) =>
  tool({
    description: `Conducts deep, autonomous research based on a conversation history. It automatically clarifies the user's intent if the request is ambiguous, breaks down the query into parallel research tasks, scours multiple web sources for information, and then synthesizes the findings into a comprehensive, well-structured report with citations. This is best for complex questions that require in-depth analysis and a detailed answer, not just a simple search. 
    
    
Important:
- If a message with role tool and toolname "deepResearch" is found in the conversation history, and this tool has an output with format "clarifying_questions", you must call this tool again to continue the research process.
- If research is successful, a report will be created by this tool and displayed to the user. No need to repeat it in your answer.
    
Use for:
- Start a research or to continue a research process
- Perform deep research (also autonomous research, deep search, or similar aliases)
- Use again if this tool was previously used, produced a clarifying question, and the user has now responded
`,
    inputSchema: z.object({}),
    execute: async (_, { toolCallId, abortSignal }) => {
      const researchConfig = getDeepResearchConfig();

      try {
        const requestId = generateUUID();
        // Log both requestId and messageId for traceability
        console.log("DeepResearch start", { requestId, messageId });

        // Open a Langfuse trace with id = requestId before the run
        const langfuse = new Langfuse();
        langfuse.trace({ id: requestId, name: "deep-research" });
        const researchResult = await runDeepResearchPipeline(
          {
            requestId,
            messageId,
            toolCallId,
            messages,
          },
          researchConfig,
          dataStream,
          { session, costAccumulator, abortSignal }
        );

        // Flush the Langfuse trace right after the run
        await langfuse.flushAsync();

        switch (researchResult.type) {
          case "report":
            return {
              ...researchResult.data,
              format: "report" as const,
            };

          case "clarifying_question":
            return {
              answer: researchResult.data,
              format: "clarifying_questions" as const,
            };
        }
      } catch (error) {
        console.error("Deep research error:", error);
        dataStream.write({
          id: generateUUID(),
          type: "data-researchUpdate",
          data: {
            toolCallId,
            timestamp: Date.now(),
            title: "Deep research failed",
            type: "completed",
          },
        });
        return {
          answer: `Deep research failed with error: ${error instanceof Error ? error.message : String(error)}`,
          format: "problem" as const,
        };
      }
    },
  });
