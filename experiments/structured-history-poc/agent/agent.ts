import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({
  defaultTools: false,
  tool: false,
  modelContextWindowTokens: 128_000,
  model: mockModel(({ userMessages, messages, toolResults }) =>
    JSON.stringify({
      users: userMessages,
      roles: messages.map((message) => message.role),
      tools: toolResults,
      assistantCount: messages.filter((message) => message.role === "assistant")
        .length,
    })
  ),
});
