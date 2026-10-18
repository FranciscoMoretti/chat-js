import { vi } from "vitest";

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

export const createEveTestSession = (): string => crypto.randomUUID();
