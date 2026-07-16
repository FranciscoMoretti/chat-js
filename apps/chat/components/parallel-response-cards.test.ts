import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  getParallelResponseLifecycle,
  getResponseAwareStatus,
  getStatusLabel,
} from "./parallel-response-status";

function createAssistantMessage(activeStreamId: string | null) {
  return {
    metadata: { activeStreamId },
  };
}

describe("parallel response card status", () => {
  it("keeps queued and streaming responses in a loading state", () => {
    assert.equal(getParallelResponseLifecycle(null), "queued");
    assert.equal(
      getParallelResponseLifecycle(
        createAssistantMessage("pending:assistant-1")
      ),
      "queued"
    );
    assert.equal(
      getParallelResponseLifecycle(createAssistantMessage("stream-1")),
      "generating"
    );
    assert.equal(getStatusLabel(true, "queued"), "Generating...");
    assert.equal(getStatusLabel(false, "generating"), "Generating...");
  });

  it("shows completion only after the stream marker is cleared", () => {
    assert.equal(
      getParallelResponseLifecycle(createAssistantMessage(null)),
      "complete"
    );
    assert.equal(getStatusLabel(true, "complete"), "Selected");
    assert.equal(getStatusLabel(false, "complete"), "Task completed");
  });

  it("keeps selected pending responses stoppable", () => {
    assert.equal(
      getResponseAwareStatus(
        "ready",
        createAssistantMessage("pending:assistant-1")
      ),
      "submitted"
    );
    assert.equal(
      getResponseAwareStatus("ready", createAssistantMessage("stream-1")),
      "streaming"
    );
    assert.equal(
      getResponseAwareStatus("ready", createAssistantMessage(null)),
      "ready"
    );
  });
});
