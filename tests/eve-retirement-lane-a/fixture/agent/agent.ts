/* oxlint-disable eslint/no-magic-numbers -- Zero tool results selects the deterministic first mock-model call. */
import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

// oxlint-disable-next-line import/no-default-export -- EVE discovers the fixture agent by default export.
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

/* oxlint-enable eslint/no-magic-numbers */
