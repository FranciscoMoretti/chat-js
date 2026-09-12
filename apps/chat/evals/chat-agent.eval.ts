import { evalite } from "evalite";

import { runCoreChatAgentEval } from "@/lib/ai/eval-agent";
import type { ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { generateUUID } from "@/lib/utils";

const evalModelId = config.ai.workflows.chat;
const answerWithChatAgent = async (input: string) => {
  // Create a user message
  const userMessage: ChatMessage = {
    id: generateUUID(),
    metadata: {
      activeStreamId: null,
      createdAt: new Date(),
      parentMessageId: null,
      selectedModel: evalModelId,
    },
    parts: [
      {
        text: input,
        type: "text",
      },
    ],
    role: "user",
  };
  // Run the core chat agent
  const result = await runCoreChatAgentEval({
    // No tools for simple Q&A
    activeTools: [],
    previousMessages: [],
    selectedModelId: evalModelId,
    userMessage,
  });
  // Return the final text output
  return result.finalText;
};
evalite("Chat Agent Eval", {
  data: () => [
    {
      expected: "Paris",
      input: "What's the capital of France?",
    },
    {
      expected: "Berlin",
      input: "What's the capital of Germany?",
    },
  ],
  scorers: [
    {
      description: "Checks if the output contains the expected answer.",
      name: "Contains Expected",
      scorer: ({ output, expected }) => {
        const lowerOutput = output.toLowerCase();
        const lowerExpected = expected.toLowerCase();
        return lowerOutput.includes(lowerExpected) ? 1 : 0;
      },
    },
  ],
  task: answerWithChatAgent,
});
