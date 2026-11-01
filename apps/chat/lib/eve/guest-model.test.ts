import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { expect, test, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { wrapLanguageModel } from "ai";
import { guestModelMiddleware } from "@/chatjs/plugins/guest-chat/guest-model";
import { GUEST_POLICY } from "@/chatjs/plugins/guest-chat/guest-policy";

vi.mock("./model-selection", () => ({ resolveEveModel: vi.fn() }));
const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
const provider = () =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: "text", text: "hello" }],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    },
  });

test("provider receives no tools and a hard output limit", async () => {
  const mock = provider();
  const wrapped = wrapLanguageModel({
    model: mock,
    middleware: guestModelMiddleware,
  });
  await wrapped.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    maxOutputTokens: 999_999,
    providerOptions: { openai: { reasoningEffort: "high" } },
    tools: [{ type: "function", name: "private", inputSchema: {} }],
    toolChoice: { type: "tool", toolName: "private" },
  });
  expect(mock.doGenerateCalls[0]).toMatchObject({
    tools: [],
    toolChoice: { type: "none" },
    maxOutputTokens: GUEST_POLICY.maxOutputTokens,
    providerOptions: { openai: { reasoningEffort: "minimal" } },
  });
});

test("accumulated oversized input and file/tool content fail before a provider call", async () => {
  const mock = provider();
  const wrapped = wrapLanguageModel({
    model: mock,
    middleware: guestModelMiddleware,
  });
  await expect(
    wrapped.doGenerate({
      prompt: [
        {
          role: "user",
          content: [
            { type: "text", text: "x".repeat(GUEST_POLICY.maxInputCharacters) },
          ],
        },
      ],
    })
  ).rejects.toThrow("input limit");
  await expect(
    wrapped.doGenerate({
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: { type: "url", url: new URL("https://private.invalid") },
              mediaType: "image/png",
            },
          ],
        },
      ],
    })
  ).rejects.toThrow("input limit");
  expect(mock.doGenerateCalls).toHaveLength(0);
});

test("a provider cannot smuggle a tool call into guest execution", async () => {
  const mock = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "tool-call",
          toolCallId: "call",
          toolName: "private",
          input: "{}",
        },
      ],
      finishReason: { unified: "tool-calls", raw: "tool_calls" },
      usage,
      warnings: [],
    },
  });
  const wrapped = wrapLanguageModel({
    model: mock,
    middleware: guestModelMiddleware,
  });
  await expect(
    wrapped.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    })
  ).rejects.toThrow("cannot invoke tools");
});

test("nonstreaming output bounds include reasoning and text together", async () => {
  const mock = new MockLanguageModelV4({
    doGenerate: {
      content: [
        {
          type: "reasoning",
          text: "x".repeat(GUEST_POLICY.maxOutputTokens * 16),
        },
        { type: "text", text: "x" },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    },
  });
  const wrapped = wrapLanguageModel({
    model: mock,
    middleware: guestModelMiddleware,
  });
  await expect(
    wrapped.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    })
  ).rejects.toThrow("output limit");
});

const streamModel = (parts: readonly LanguageModelV4StreamPart[]) =>
  wrapLanguageModel({
    model: new MockLanguageModelV4({
      doStream: {
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            for (const part of parts) {
              controller.enqueue(part);
            }
            controller.close();
          },
        }),
      },
    }),
    middleware: guestModelMiddleware,
  });
const toolParts: LanguageModelV4StreamPart[] = [
  { type: "tool-call", toolCallId: "call", toolName: "private", input: "{}" },
  { type: "tool-input-start", id: "call", toolName: "private" },
  { type: "tool-input-delta", id: "call", delta: "{}" },
  { type: "tool-input-end", id: "call" },
];

test.each(toolParts)(
  "streaming rejects $type before delivery",
  async (part) => {
    const result = await streamModel([part]).doStream({
      prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
    });
    await expect(result.stream.getReader().read()).rejects.toThrow(
      "cannot invoke tools"
    );
  }
);

test("streaming cumulatively bounds text and reasoning before the excess chunk is delivered", async () => {
  const result = await streamModel([
    {
      type: "reasoning-delta",
      id: "reason",
      delta: "x".repeat(GUEST_POLICY.maxOutputTokens * 16),
    },
    { type: "text-delta", id: "text", delta: "x" },
  ]).doStream({
    prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
  });
  const reader = result.stream.getReader();
  const first = await reader.read();
  expect(first.value?.type).toBe("reasoning-delta");
  await expect(reader.read()).rejects.toThrow("output limit");
});

test("safe assistant reasoning history permits a second guest turn", async () => {
  const mock = provider();
  const wrapped = wrapLanguageModel({
    model: mock,
    middleware: guestModelMiddleware,
  });
  await wrapped.doGenerate({
    prompt: [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
      {
        role: "assistant",
        content: [
          { type: "reasoning", text: "A short greeting is appropriate." },
          { type: "text", text: "Hello!" },
        ],
      },
      { role: "user", content: [{ type: "text", text: "How are you?" }] },
    ],
  });
  expect(mock.doGenerateCalls).toHaveLength(1);
});
