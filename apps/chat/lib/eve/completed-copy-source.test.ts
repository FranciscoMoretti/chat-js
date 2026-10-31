import type * as EveClient from "eve/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { SessionStreamEvent } from "eve/client";
import { readCompletedEveCopyTranscript } from "./completed-copy-source";
import { EveCopyNotReadyError } from "./copy-transcript";

const snapshot = vi.hoisted(() =>
  vi.fn<() => Promise<{ events: SessionStreamEvent[] }>>()
);
vi.mock("eve/client", async (original) => ({
  ...(await original<typeof EveClient>()),
  Client: class {
    sessions = { attach: () => ({ snapshot }) };
  },
}));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
const meta = { at: "2026-10-17T00:00:00Z", id: "event" };
const history: SessionStreamEvent = {
  type: "history.seeded",
  meta,
  data: {
    messages: [
      {
        id: "seed_message_0",
        role: "user",
        parts: [{ type: "text", text: "Question" }],
      },
      {
        id: "seed_message_1",
        role: "assistant",
        parts: [{ type: "text", text: "Answer", state: "done" }],
      },
    ],
  },
};
const waiting: SessionStreamEvent = {
  type: "session.waiting",
  meta,
  data: { continuationToken: "idle", wait: "next-user-message" },
};
beforeEach(() => {
  snapshot.mockReset();
});
it("copies a completed transcript without retaining native identities", async () => {
  snapshot.mockResolvedValue({ events: [history, waiting] });
  const result = await readCompletedEveCopyTranscript(
    "owner",
    "source",
    [],
    []
  );
  expect(result.seed.messages).toHaveLength(2);
  expect(JSON.stringify(result.seed)).not.toContain("seed_message");
});
it.each([
  { kind: "create", sessionId: null, deliveryId: null },
  { kind: "send", sessionId: "source", deliveryId: null },
])(
  "rejects unresolved dispatches before reading native state",
  async (dispatch) => {
    await expect(
      readCompletedEveCopyTranscript("owner", "source", [dispatch], [])
    ).rejects.toThrow(EveCopyNotReadyError);
    expect(snapshot).not.toHaveBeenCalled();
  }
);
it("rejects an accepted send not yet visible in native history", async () => {
  snapshot.mockResolvedValue({ events: [history, waiting] });
  await expect(
    readCompletedEveCopyTranscript(
      "owner",
      "source",
      [{ kind: "send", sessionId: "source", deliveryId: "pending" }],
      []
    )
  ).rejects.toThrow(EveCopyNotReadyError);
});
it.each(["turn.cancelled", "turn.failed"] as const)(
  "rejects %s even after the session becomes idle",
  async (type) => {
    const outcome: SessionStreamEvent =
      type === "turn.cancelled"
        ? { type, meta, data: { sequence: 1, turnId: "turn_0" } }
        : {
            type,
            meta,
            data: {
              sequence: 1,
              turnId: "turn_0",
              code: "failed",
              message: "Failed",
            },
          };
    snapshot.mockResolvedValue({ events: [history, outcome, waiting] });
    await expect(
      readCompletedEveCopyTranscript("owner", "source", [], [])
    ).rejects.toThrow(EveCopyNotReadyError);
  }
);
it("rejects an open turn parked for approval", async () => {
  snapshot.mockResolvedValue({
    events: [
      history,
      {
        type: "turn.waiting",
        meta,
        data: { sequence: 1, turnId: "turn_0", on: "input" },
      },
    ],
  });
  await expect(
    readCompletedEveCopyTranscript("owner", "source", [], [])
  ).rejects.toThrow(EveCopyNotReadyError);
});
