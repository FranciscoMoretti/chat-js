import type { TextStreamPart, ToolSet } from "ai";
import { expect, it } from "vitest";

import { markdownJoinerTransform } from "./markdown-joiner-transform";

it("flushes buffered markdown before its text part ends, retaining the part ID", async () => {
  const chunks: TextStreamPart<ToolSet>[] = [
    { id: "first", type: "text-start" },
    { id: "first", text: "Result [", type: "text-delta" },
    { id: "first", type: "text-end" },
    { id: "second", type: "text-start" },
    { id: "second", text: "next", type: "text-delta" },
    { id: "second", type: "text-end" },
  ];
  const source = new ReadableStream<TextStreamPart<ToolSet>>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  const output: TextStreamPart<ToolSet>[] = [];
  for await (const chunk of source.pipeThrough(markdownJoinerTransform()())) {
    output.push(chunk);
  }
  expect(output).toEqual([
    chunks[0],
    { id: "first", text: "Result ", type: "text-delta" },
    { id: "first", text: "[", type: "text-delta" },
    chunks[2],
    chunks[3],
    chunks[4],
    chunks[5],
  ]);
});
