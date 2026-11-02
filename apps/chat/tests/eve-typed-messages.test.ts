import { expect, expectTypeOf, test, vi } from "vitest";
import { conversationReducer } from "eve/client";
import { LogicalChat } from "@/lib/eve/logical-chat";
import type { NativeChatAgent } from "@/lib/eve/logical-chat";
import { createToolError, createToolResult } from "@/lib/eve/tool-result";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import { nativeMessage, nativeMessages } from "@/lib/ai/chat-message";
import type { ChatMessage, ChatToolPart } from "@/lib/ai/chat-message";
import {
  projectChatMessage,
  projectChatMessagePart,
  projectChatMessages,
} from "@/lib/ai/project-chat-messages";

const identity = {
  toolCallId: "count-1",
  toolName: "wordCount",
  type: "dynamic-tool",
  stepIndex: 2,
} as const;
const input = { text: "one two" };
const output = { words: 2, characters: 7, charactersNoSpaces: 6, sentences: 1 };
const completed = {
  ...identity,
  state: "output-available",
  input,
  output: createToolResult(output, 0, [{ label: "Counted" }]),
} as const;

test("name and lifecycle narrow input/output from the authored tools through ChatMessage", () => {
  const part: ChatMessage["parts"][number] = projectChatMessagePart(completed);
  if (part.type !== "tool-wordCount" || part.state !== "output-available") {
    throw new Error("Expected a typed completed word count");
  }
  expectTypeOf(part.input.text).toEqualTypeOf<string>();
  expectTypeOf(part.output.words).toEqualTypeOf<number>();
  // @ts-expect-error Outputs from another installed tool cannot leak into this branch.
  expectTypeOf(part.output.current).toBeUnknown();
  expect(part.output).toEqual(output);
  expect(part.updates).toEqual([{ label: "Counted" }]);
  expect(part.native).toBe(completed);
  expect(part.stepIndex).toBe(2);
  expectTypeOf<
    Extract<
      ChatToolPart,
      { type: "tool-wordCount"; state: "output-error" }
    >["input"]
  >().toBeUnknown();
  expectTypeOf<
    Extract<
      ChatToolPart,
      { type: "tool-wordCount"; state: "input-streaming" }
    >["input"]
  >().toEqualTypeOf<{ text?: string } | undefined>();
});

test("preserves input streaming, approval, denial, and native error states", () => {
  const states: readonly Extract<
    ReadonlyEveMessagePart,
    { type: "dynamic-tool" }
  >[] = [
    {
      ...identity,
      state: "input-streaming",
      input: { text: "one" },
      inputText: '{"text":"one',
    },
    { ...identity, state: "input-available", input },
    {
      ...identity,
      state: "approval-requested",
      input,
      approval: { id: "approval-1" },
    },
    {
      ...identity,
      state: "approval-responded",
      input,
      approval: { id: "approval-1", approved: true },
    },
    {
      ...identity,
      state: "output-denied",
      input,
      approval: { id: "approval-1", approved: false, reason: "Declined" },
    },
    {
      ...identity,
      state: "output-error",
      input: undefined,
      errorText: "Invalid input",
    },
  ];
  for (const part of states) {
    expect(projectChatMessagePart(part)).toEqual({
      ...part,
      type: "tool-wordCount",
      native: part,
    });
  }
});

test("keeps preliminary output distinguishable from the final result", () => {
  const part = projectChatMessagePart({ ...completed, partial: true });
  if (part.type !== "tool-wordCount" || part.state !== "output-available") {
    throw new Error("Expected typed preliminary output");
  }
  expect(part.partial).toBe(true);
  expect(part.output).toEqual(output);
  const final = projectChatMessagePart(completed);
  expect(final).not.toHaveProperty("partial");
});

test("converts error receipts without losing progress or the native evidence", () => {
  const failed = {
    ...completed,
    output: createToolError(0, [{ label: "Attempted" }]),
  };
  const part = projectChatMessagePart(failed);
  if (part.type !== "tool-wordCount" || part.state !== "output-error") {
    throw new Error("Expected a typed tool failure");
  }
  expect(part.errorText).toBe("The tool did not complete.");
  expect(part.output).toBeUndefined();
  expect(part.updates).toEqual([{ label: "Attempted" }]);
  expect(part.native).toBe(failed);
});

test("retains unknown tools, imported text and unsupported receipt versions as native parts", () => {
  const fallbacks: readonly ReadonlyEveMessagePart[] = [
    { ...completed, toolName: "mcp_remote_search" },
    { ...completed, toolName: "removedTool" },
    { ...completed, outputType: "text", output: "Imported text" },
    {
      ...completed,
      output: {
        kind: "chatjs.tool-result",
        version: 2,
        status: "success",
        output,
      },
    },
  ];
  for (const part of fallbacks) {
    expect(projectChatMessagePart(part)).toBe(part);
  }
});

test("enriches plain outputs without requiring a ChatJS receipt", () => {
  const part = projectChatMessagePart({ ...completed, output });
  expect(part).toMatchObject({ type: "tool-wordCount", input, output });
});

test("preserves metadata and native round trips without mutating replay data", () => {
  const message: ReadonlyEveMessage = {
    id: "assistant-1",
    role: "assistant",
    metadata: {
      turnId: "turn-1",
      modelId: "model",
      custom: { display: "imported" },
    },
    parts: [{ type: "text", text: "Result" }, completed],
  };
  const projected = projectChatMessage(message);
  expect(projected.metadata).toBe(message.metadata);
  expect(projected.parts[0]).toBe(message.parts[0]);
  expect(projected.parts[1].type).toBe("tool-wordCount");
  expect(message.parts[1].type).toBe("dynamic-tool");
  expect(nativeMessage(projected)).toEqual(message);
  expect(nativeMessage(projected)).toBe(nativeMessage(projected));
  expect(nativeMessage(projected).parts[1]).toBe(completed);
  expect(projectChatMessage(message)).toBe(projected);
  expect(projectChatMessage(projected)).toBe(projected);

  const data = { messages: [message] };
  const snapshot = projectChatMessages(data);
  expect(projectChatMessages(data)).toBe(snapshot);
  expect(projectChatMessages(snapshot)).toBe(snapshot);
  expect(snapshot.messages[0]).toBe(projected);
  expect(nativeMessages(snapshot.messages)).toBe(
    nativeMessages(snapshot.messages)
  );
});

test("publishes typed tool messages once without changing the native snapshot", () => {
  const chat = new LogicalChat("chat", "root");
  const runtime: NativeChatAgent = {
    cancel: vi
      .fn<NativeChatAgent["cancel"]>()
      .mockRejectedValue(new Error("unused")),
    conversation: conversationReducer.initial(),
    data: {
      messages: [{ id: "assistant", role: "assistant", parts: [completed] }],
    },
    error: undefined,
    events: [],
    prewarm: vi.fn<NativeChatAgent["prewarm"]>().mockResolvedValue(),
    reset: vi.fn<NativeChatAgent["reset"]>(),
    respond: vi.fn<NativeChatAgent["respond"]>().mockResolvedValue(),
    resume: vi.fn<NativeChatAgent["resume"]>().mockResolvedValue(),
    send: vi.fn<NativeChatAgent["send"]>().mockResolvedValue(),
    session: undefined,
    status: "ready",
  };
  const published = vi.fn<() => void>();
  chat.subscribe(published);
  chat.observe("root", runtime);
  const snapshot = chat.getSnapshot();
  const part = snapshot.agents.get("root")?.data.messages[0].parts[0];
  expect(part?.type).toBe("tool-wordCount");
  expect(runtime.data.messages[0].parts[0].type).toBe("dynamic-tool");
  chat.observe("root", runtime);
  expect(chat.getSnapshot()).toBe(snapshot);
  expect(published).toHaveBeenCalledTimes(1);
});
