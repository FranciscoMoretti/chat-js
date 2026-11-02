import type * as EveClient from "eve/client";
import { vi } from "vitest";

const sessions = vi.hoisted(() => new Set<string>());
// Preserve the real workspace reconciler; only synthetic sessions have terminal
// native evidence. Missing sessions must still leave admission fenced.
vi.mock("eve/client", async (importOriginal) => ({
  ...(await importOriginal<typeof EveClient>()),
  Client: class {
    public sessions = {
      attach: (sessionId: string) => ({
        snapshot: () => {
          if (!sessions.has(sessionId)) {
            throw new Error("Native fixture session not found");
          }
          return {
            events: [
              { type: "session.started", data: {} },
              {
                type: "delivery.admitted",
                data: { deliveryId: `delivery-${sessionId}` },
              },
              {
                type: "turn.started",
                data: {
                  turnId: "fixture-turn",
                  cause: { deliveryId: `delivery-${sessionId}` },
                  follows: null,
                },
              },
              {
                type: "delivery.consumed",
                data: {
                  deliveryId: `delivery-${sessionId}`,
                  turnId: "fixture-turn",
                  parts: [{ kind: "text", text: "Fixture" }],
                },
              },
              {
                type: "delivery.settled",
                data: {
                  deliveryId: `delivery-${sessionId}`,
                  turnId: "fixture-turn",
                  outcome: "handled",
                },
              },
              {
                type: "turn.settled",
                data: { turnId: "fixture-turn", outcome: "completed" },
              },
            ].map((event, line) => ({
              ...event,
              meta: {
                at: "2026-11-02T00:00:00Z",
                position: { line, index: 0 },
                endOfLine: true,
              },
            })),
          };
        },
      }),
    };
  },
}));

// Database contract suites use synthetic session IDs. Native readiness is tested
// separately at completed-copy-source; these fixtures represent settled history.
vi.mock("../lib/eve/completed-copy-source", () => ({
  readCompletedEveCopyTranscript: vi.fn().mockResolvedValue({
    seed: {
      messages: [
        {
          role: "user",
          parts: [{ type: "text", text: "Completed fixture conversation" }],
        },
      ],
    },
    resources: { fileKeys: [], documentIds: [], revisionIds: [] },
    projectionHash: "database-fixture",
  }),
}));

export const createEveTestSession = async (): Promise<{
  sessionId: string;
  deliveryId: string;
}> => {
  const id = crypto.randomUUID();
  sessions.add(id);
  return await Promise.resolve({ sessionId: id, deliveryId: `delivery-${id}` });
};
