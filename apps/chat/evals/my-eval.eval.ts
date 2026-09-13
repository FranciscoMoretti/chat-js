import { streamText } from "ai";
import { evalite } from "evalite";

import { getActiveGateway } from "@/lib/ai/active-gateway";
import { config } from "@/lib/config";

evalite("Test Capitals", {
  data: async () => [
    {
      input: `What's the capital of France?`,
      expected: "Paris",
    },
    {
      input: `What's the capital of Germany?`,
      expected: "Berlin",
    },
  ],
  task: async (input) => {
    const result = streamText({
      model: getActiveGateway().createLanguageModel(config.ai.workflows.chat),
      instructions: "Answer the question concisely.",
      prompt: input,
    });

    // Evalite's SDK 6 model wrapper cannot trace provider-v4 models yet.
    return await result.output;
  },
  scorers: [
    {
      name: "Contains Paris",
      description: "Checks if the output contains the word 'Paris'.",
      scorer: ({ output, expected }) => (output.includes(expected) ? 1 : 0),
    },
  ],
});
