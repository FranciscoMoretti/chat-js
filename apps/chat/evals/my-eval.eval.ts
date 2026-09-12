import { streamText } from "ai";
import { evalite } from "evalite";

import { getActiveGateway } from "@/lib/ai/active-gateway";
import { config } from "@/lib/config";

const answerWithGateway = async (input: string) => {
  const result = streamText({
    instructions: "Answer the question concisely.",
    model: getActiveGateway().createLanguageModel(config.ai.workflows.chat),
    prompt: input,
  });

  // Evalite's SDK 6 model wrapper cannot trace provider-v4 models yet.
  return await result.output;
};

evalite("Test Capitals", {
  data: () => [
    {
      expected: "Paris",
      input: `What's the capital of France?`,
    },
    {
      expected: "Berlin",
      input: `What's the capital of Germany?`,
    },
  ],
  scorers: [
    {
      description: "Checks if the output contains the word 'Paris'.",
      name: "Contains Paris",
      scorer: ({ output, expected }) => (output.includes(expected) ? 1 : 0),
    },
  ],
  task: answerWithGateway,
});
