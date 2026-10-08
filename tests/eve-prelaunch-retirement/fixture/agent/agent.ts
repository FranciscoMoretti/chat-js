import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

const noResults = 0;

// oxlint-disable-next-line import/no-default-export -- EVE's compiler discovers the fixture through its default export.
export default defineAgent({
  defaultTools: false,
  description: "Compiled dynamic approval restart fixture",
  model: mockModel(({ toolResults, tools }) => {
    if (toolResults.some((result) => result.isError)) {
      throw new Error(JSON.stringify({ toolResults, tools }));
    }
    return toolResults.length > noResults
      ? "Done"
      : {
          toolCalls: [
            {
              input: { amount: "7" },
              name:
                tools.find((tool) => tool.name.includes("act"))?.name ??
                "missing",
            },
          ],
        };
  }),
  modelContextWindowTokens: 128_000,
});
