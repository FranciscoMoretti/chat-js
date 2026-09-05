import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { evalite } from "evalite";

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
      model: openai("gpt-4o-mini"),
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
