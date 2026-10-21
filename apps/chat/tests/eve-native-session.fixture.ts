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
              { type: "message.received", data: { turnId: "fixture-turn" } },
              { type: "turn.completed", data: { turnId: "fixture-turn" } },
              { type: "session.waiting" },
            ],
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

export const createEveTestSession = (): string => {
  const id = crypto.randomUUID();
  sessions.add(id);
  return id;
};
