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
const meta = {
  at: "2026-10-17T00:00:00Z",
  position: { line: 0, index: 0 },
  endOfLine: true,
};
const history: SessionStreamEvent = {
  type: "session.started",
  meta,
  data: {
    transcriptSeed: {
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "Question" }],
        },
        {
          role: "assistant",
          parts: [{ type: "text", text: "Answer" }],
        },
      ],
    },
  },
};
const started: SessionStreamEvent = {
  type: "turn.started",
  meta: { ...meta, position: { line: 1, index: 0 } },
  data: { turnId: "turn_0", follows: null },
};
beforeEach(() => {
  snapshot.mockReset();
});
it("copies a completed transcript without retaining native identities", async () => {
  snapshot.mockResolvedValue({ events: [history] });
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
  snapshot.mockResolvedValue({ events: [history] });
  await expect(
    readCompletedEveCopyTranscript(
      "owner",
      "source",
      [{ kind: "send", sessionId: "source", deliveryId: "pending" }],
      []
    )
  ).rejects.toThrow(EveCopyNotReadyError);
});
it.each(["cancelled", "failed"] as const)(
  "rejects %s even after the session becomes idle",
  async (outcome) => {
    const settled: SessionStreamEvent = {
      type: "turn.settled",
      meta: { ...meta, position: { line: 2, index: 0 } },
      data: { turnId: "turn_0", outcome },
    };
    snapshot.mockResolvedValue({ events: [history, started, settled] });
    await expect(
      readCompletedEveCopyTranscript("owner", "source", [], [])
    ).rejects.toThrow(EveCopyNotReadyError);
  }
);
it("rejects an open turn parked for approval", async () => {
  snapshot.mockResolvedValue({
    events: [
      history,
      started,
      {
        type: "turn.paused",
        meta: { ...meta, position: { line: 2, index: 0 } },
        data: { turnId: "turn_0" },
      },
    ],
  });
  await expect(
    readCompletedEveCopyTranscript("owner", "source", [], [])
  ).rejects.toThrow(EveCopyNotReadyError);
});
