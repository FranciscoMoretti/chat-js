import { expect, it } from "vitest";

import { parseEveCopySeed } from "./copy-seed";
import { prepareEveCopyPlan } from "./prepare-copy-plan";
import { eveSeedSearchText } from "./search-text";

it("validates the actual prepared copy plan without losing settled tool output or model provenance", async () => {
  const seed = parseEveCopySeed({
    messages: [
      { role: "user", parts: [{ type: "text", text: "Read my notes" }] },
      {
        role: "assistant",
        modelId: "gateway/openai/model",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "readFile",
            input: { path: "notes.txt" },
            state: "output-available",
            output: "notes",
            outputType: "text",
          },
        ],
      },
    ],
  });
  const plan = await prepareEveCopyPlan(
    { seed, resources: { fileKeys: [], documentIds: [], revisionIds: [] } },
    { documents: [], checkpoints: [] },
    () => {
      throw new Error("No source file should be read");
    },
    "https://chat.example"
  );
  expect(plan.seed).toEqual({ ...seed, attachments: "channel" });
  expect(plan.seed).not.toBe(seed);
  expect(plan.seed.messages).not.toBe(seed.messages);
  expect(seed.attachments).toBeUndefined();
  expect(eveSeedSearchText(plan.seed.messages)).toEqual([
    { key: "seed:0", text: "Read my notes" },
  ]);
});

it("rejects executable or incomplete copy data and invalid text tool results before acceptance", () => {
  const tool = {
    type: "dynamic-tool",
    toolName: "readFile",
    input: {},
    state: "output-available",
    output: "notes",
    outputType: "text",
  };
  for (const part of [
    { ...tool, state: "input-available" },
    { ...tool, output: { value: "notes" } },
    { ...tool, approval: { id: "live-request" } },
    {
      type: "file",
      url: "eve-sandbox:/source/private.txt",
      mediaType: "text/plain",
    },
  ]) {
    expect(() =>
      parseEveCopySeed({ messages: [{ role: "assistant", parts: [part] }] })
    ).toThrow();
  }
  expect(() =>
    parseEveCopySeed({ messages: [], checkpoint: "runtime-state" })
  ).toThrow();
  expect(() =>
    parseEveCopySeed({
      messages: [{ role: "system", parts: [{ type: "text", text: "policy" }] }],
    })
  ).toThrow();
  expect(() =>
    parseEveCopySeed({
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "x".repeat(8_388_608) }],
        },
      ],
    })
  ).toThrow("byte limit");
});
