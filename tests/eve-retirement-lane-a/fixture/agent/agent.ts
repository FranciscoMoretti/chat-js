import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

export default defineAgent({
  defaultTools: false,
  description: "Lane A native deletion approval proof",
  model: mockModel(({ toolResults }) =>
    toolResults.length > 0
      ? "Finished."
      : {
          toolCalls: [
            {
              input: {
                documentId: "document",
                expectedRevisionId: "revision-1",
                title: "Notes",
              },
              name: "delete-document",
            },
          ],
        }
  ),
  modelContextWindowTokens: 128_000,
});
