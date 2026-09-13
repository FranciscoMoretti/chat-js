import { evalite } from "evalite";

import { runCoreChatAgentEval } from "@/lib/ai/eval-agent";
import type { ChatMessage } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { generateUUID } from "@/lib/utils";

const evalModelId = config.ai.workflows.chat;

evalite("Chat Agent Eval", {
  data: async () => [
    {
      input: "What's the capital of France?",
      expected: "Paris",
    },
    {
      input: "What's the capital of Germany?",
      expected: "Berlin",
    },
  ],
  task: async (input) => {
    // Create a user message
    const userMessage: ChatMessage = {
      id: generateUUID(),
      role: "user",
      parts: [
        {
          type: "text",
          text: input,
        },
      ],
      metadata: {
        createdAt: new Date(),
        parentMessageId: null,
        selectedModel: evalModelId,
        activeStreamId: null,
      },
    };

    // Run the core chat agent
    const result = await runCoreChatAgentEval({
      userMessage,
      previousMessages: [],
      selectedModelId: evalModelId,
      activeTools: [], // No tools for simple Q&A
    });

    // Return the final text output
    return result.finalText;
  },
  scorers: [
    {
      name: "Contains Expected",
      description: "Checks if the output contains the expected answer.",
      scorer: ({ output, expected }) => {
        const lowerOutput = output.toLowerCase();
        const lowerExpected = expected.toLowerCase();
        return lowerOutput.includes(lowerExpected) ? 1 : 0;
      },
    },
  ],
});
