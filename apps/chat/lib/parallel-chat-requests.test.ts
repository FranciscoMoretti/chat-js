import assert from "node:assert/strict";
import type { TreeHelpers } from "@chatjs/thread/react";
import { afterEach, describe, it, vi } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import type { ParallelRequestSpec } from "./draft-chat-submission";
import { runParallelThreadRequestSpecs } from "./parallel-chat-requests";

const message = {
  id: "user-follow-up",
  metadata: {
    activeStreamId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    isPrimaryParallel: null,
    parallelGroupId: "response-group-1",
    parallelIndex: null,
    parentMessageId: null,
    selectedModel: "openai/gpt-5-mini",
  },
  parts: [{ type: "text", text: "Compare both approaches" }],
  role: "user",
} satisfies ChatMessage;

type RunHandle = Awaited<ReturnType<TreeHelpers<ChatMessage>["startRun"]>>;
type RunSnapshot = NonNullable<ReturnType<RunHandle["getSnapshot"]>>;

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
    assert.deepEqual(startRun.mock.calls[1]?.[0], {
      follow: false,
      from: message.id,
      request: {
        body: {
          assistantMessageId: "assistant-nano",
          isPrimaryParallel: false,
          parallelGroupId: "response-group-1",
          parallelIndex: 2,
          projectId: "project-1",
          selectedModelId: "openai/gpt-5-nano",
        },
      },
    });
    assert.equal(settled, false);

    for (const resolve of finishResolvers) {
      resolve();
    }

    assert.deepEqual(await resultPromise, []);
  });

  it("reports only runs whose final snapshots failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );
    const failure = new Error("secondary response failed");
    const snapshots = [
      { error: failure, id: "failed-run", status: "error" },
      { error: undefined, id: "ready-run", status: "ready" },
    ] satisfies RunSnapshot[];
    let runIndex = 0;
    const startRun = vi.fn<TreeHelpers<ChatMessage>["startRun"]>(() => {
      const snapshot = snapshots[runIndex++];
      if (!snapshot) {
        throw new Error("Unexpected parallel run");
      }

      return Promise.resolve({
        finished: Promise.resolve(),
        getSnapshot: () => snapshot,
        id: snapshot.id,
        stop: () => Promise.resolve(),
      });
    });

    assert.deepEqual(
      await runParallelThreadRequestSpecs({
        chatId: "chat-1",
        message,
        projectId: null,
        requestSpecs,
        startRun,
      }),
      [requestSpecs[0]]
    );
  });
});
