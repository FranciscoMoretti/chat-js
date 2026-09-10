import type { TextStreamPart, ToolSet } from "ai";
import { expect, it } from "vitest";
import { markdownJoinerTransform } from "./markdown-joiner-transform";

it("flushes buffered markdown before its text part ends, retaining the part ID", async () => {
  const chunks: TextStreamPart<ToolSet>[] = [
    { type: "text-start", id: "first" },
    { type: "text-delta", id: "first", text: "Result [" },
    { type: "text-end", id: "first" },
    { type: "text-start", id: "second" },
    { type: "text-delta", id: "second", text: "next" },
    { type: "text-end", id: "second" },
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
    { type: "text-delta", id: "first", text: "Result " },
    { type: "text-delta", id: "first", text: "[" },
    chunks[2],
    chunks[3],
    chunks[4],
    chunks[5],
  ]);
});
