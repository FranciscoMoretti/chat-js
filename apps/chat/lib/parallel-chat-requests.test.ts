import assert from "node:assert/strict";
import type { TreeHelpers } from "@chatjs/thread/react";
import { afterEach, describe, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import type { ParallelRequestSpec } from "./draft-chat-submission";
import { runParallelThreadRequestSpecs } from "./parallel-chat-requests";

const message = {
  id: "user-follow-up",
  parts: [{ type: "text", text: "Compare both approaches" }],
  role: "user",
} as ChatMessage;

const requestSpecs = [
  {
    assistantMessageId: "assistant-mini",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isPrimary: false,
    modelId: "openai/gpt-5-mini",
    parallelGroupId: "response-group-1",
    parallelIndex: 1,
  },
  {
    assistantMessageId: "assistant-nano",
    createdAt: new Date("2026-01-01T00:00:00.001Z"),
    isPrimary: false,
    modelId: "openai/gpt-5-nano",
    parallelGroupId: "response-group-1",
    parallelIndex: 2,
  },
] satisfies ParallelRequestSpec[];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runParallelThreadRequestSpecs", () => {
  it("starts secondary responses as live thread runs with response-group identity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );

    const finishResolvers: Array<() => void> = [];
    const startRun = vi.fn<TreeHelpers<ChatMessage>["startRun"]>(() => {
      const finished = new Promise<void>((resolve) => {
        finishResolvers.push(resolve);
      });
      return Promise.resolve({
        assistantMessageId: "unused",
        finished,
        getSnapshot: () => undefined,
        id: "unused",
        stop: () => Promise.resolve(),
      });
    });

    let settled = false;
    const resultPromise = runParallelThreadRequestSpecs({
      chatId: "chat-1",
      message,
      projectId: "project-1",
      requestSpecs,
      startRun,
    }).then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => {
      assert.equal(startRun.mock.calls.length, 2);
    });

    assert.deepEqual(startRun.mock.calls[0]?.[0], {
      follow: false,
      from: message.id,
      request: {
        body: {
          assistantMessageId: "assistant-mini",
          isPrimaryParallel: false,
          parallelGroupId: "response-group-1",
          parallelIndex: 1,
          projectId: "project-1",
          selectedModelId: "openai/gpt-5-mini",
        },
      },
    });
    assert.equal(settled, false);

    for (const resolve of finishResolvers) {
      resolve();
    }

    assert.deepEqual(await resultPromise, []);
  });

  it("starts confirmed provisional runs without preparing persistence again", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const startRun = vi.fn<TreeHelpers<ChatMessage>["startRun"]>(() =>
      Promise.resolve({
        assistantMessageId: "assistant-mini",
        finished: Promise.resolve(),
        getSnapshot: () => undefined,
        id: "assistant-mini",
        stop: () => Promise.resolve(),
      })
    );

    assert.deepEqual(
      await runParallelThreadRequestSpecs({
        chatId: "chat-1",
        message,
        projectId: null,
        requestSpecs: requestSpecs.slice(0, 1),
        startRun,
        userMessagePersisted: true,
      }),
      []
    );

    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(startRun.mock.calls.length, 1);
  });
});
