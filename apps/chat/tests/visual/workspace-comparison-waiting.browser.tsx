import React, { act } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { EveLogicalGroupRecovery } from "@/components/eve/eve-logical-group-recovery";
import { createDomHarness } from "@/components/test-dom-harness";
import { retainResponseGroupDraft } from "@/lib/eve/create-response-group";
import { prepareResponseGroupCreation } from "@/lib/eve/pending-create";
import type { EveResponseGroupResult } from "@/lib/eve/response-group-contracts";

const fixtures = vi.hoisted(() => ({
  client: {
    invalidateQueries: vi.fn<() => Promise<void>>().mockResolvedValue(),
  },
  trpc: { eve: { branches: { pathKey: () => ["branches"] } } },
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => fixtures.client,
}));
vi.mock("@/trpc/react", () => ({ useTRPC: () => fixtures.trpc }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

test.each([true, false])(
  "waiting comparisons retain visible recovery after a lost reply (auto-only: %s)",
  async (autoOnly) => {
    vi.useFakeTimers();
    const operation = prepareResponseGroupCreation(
      sessionStorage,
      "owner",
      "Question",
      ["model-a", "model-b"]
    );
    const result: EveResponseGroupResult = {
      id: crypto.randomUUID(),
      candidates: [
        {
          modelId: "model-a",
          operationId: crypto.randomUUID(),
          conversationId: crypto.randomUUID(),
          sessionId: "native-a",
          state: "bound",
        },
        {
          modelId: "model-b",
          operationId: crypto.randomUUID(),
          state: "waiting",
        },
      ],
    };
    retainResponseGroupDraft(sessionStorage, "owner", operation, result);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(result))
      .mockRejectedValueOnce(new Error("Lost reply"));
    vi.stubGlobal("fetch", fetcher);
    let rendered: ReturnType<typeof createDomHarness> | undefined;
    act(() => {
      rendered = createDomHarness(
        <EveLogicalGroupRecovery
          autoOnly={autoOnly}
          groupId={result.id}
          ownerId="owner"
        />
      );
    });
    if (!rendered) {
      throw new Error("Missing harness");
    }
    const harness = rendered;
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(harness.container.textContent).toContain(
        "Waiting for the shared workspace"
      );
      if (!autoOnly) {
        expect(harness.container.querySelector("button")?.disabled).toBe(true);
      }
      expect(fetcher).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(harness.container.textContent).toContain(
        "This response is not confirmed"
      );
      expect(harness.container.querySelector("button")?.disabled).toBe(false);
      expect(harness.container.textContent).toContain("Lost reply");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000);
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      act(() => {
        harness.unmount();
      });
    }
  }
);
