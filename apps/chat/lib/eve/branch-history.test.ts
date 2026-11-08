import { expect, it } from "vitest";
import { nativeBranchHistory } from "./branch-history";
import { parseEveCopySeed } from "./copy-seed";

it("imports completed content without exporting app metadata or runtime capabilities", () => {
  const history = nativeBranchHistory(
    parseEveCopySeed({
      messages: [
        {
          role: "user",
          metadata: { chatjs: { selectedTool: "webSearch" } },
          parts: [
            {
              type: "file",
              url: "https://app.test/api/files/owned",
              mediaType: "application/pdf",
              filename: "notes.pdf",
              size: 42,
            },
          ],
        },
        {
          role: "assistant",
          modelId: "private/model",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "readFile",
              input: { path: "notes.pdf" },
              state: "output-available",
              output: "Original notes",
              outputType: "text",
            },
            { type: "text", text: "Summary" },
          ],
        },
      ],
    })
  );
  expect(history.map((message) => message.id)).toEqual(["0", "1"]);
  expect(history[0]?.parts[0]).toEqual({
    type: "file",
    url: "https://app.test/api/files/owned",
    mediaType: "application/pdf",
    filename: "notes.pdf",
  });
  expect(history[1]?.parts[0]).toMatchObject({
    state: "output-available",
    outputType: "text",
    output: "Original notes",
  });
  expect(JSON.stringify(history)).not.toMatch(
    /modelId|selectedTool|existingPath|size/u
  );
});

it("permits an empty prefix when replacing the first message", () => {
  expect(nativeBranchHistory(parseEveCopySeed({ messages: [] }))).toEqual([]);
});
