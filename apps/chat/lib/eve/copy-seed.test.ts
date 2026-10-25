import { expect, it } from "vitest";

import { parseEveCopySeed, requireWorkspaceSeedPaths } from "./copy-seed";

it("validates detached shared history without losing settled tool output or model provenance", () => {
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
  const detached = parseEveCopySeed({ ...seed, attachments: "channel" });
  expect(detached).toEqual({ ...seed, attachments: "channel" });
  expect(detached).not.toBe(seed);
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

it("rejects a persisted file seed without its observed shared workspace path", () => {
  const file = {
    type: "file",
    url: "https://app.test/api/files/original",
    mediaType: "application/pdf",
  };
  const seed = parseEveCopySeed({
    attachments: "channel",
    messages: [{ role: "user", parts: [file] }],
  });
  expect(() => requireWorkspaceSeedPaths(seed)).toThrow(
    "authorized workspace path"
  );
  const ready = parseEveCopySeed({
    ...seed,
    messages: [
      {
        role: "user",
        parts: [
          {
            ...file,
            existingPath: "/workspace/.eve/attachments/observed/original.pdf",
          },
        ],
      },
    ],
  });
  expect(requireWorkspaceSeedPaths(ready)).toEqual(ready);
});
