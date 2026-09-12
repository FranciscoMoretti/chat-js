import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { AppModelDefinition } from "@/lib/ai/app-models";

import { ChatModelsProvider, useChatModels } from "./chat-models-provider";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: () => new Set(),
}));

vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({
    settings: {
      getModelPreferences: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const models: AppModelDefinition[] = [];

const ContextProbe = ({ onValue }: { onValue: (value: unknown) => void }) => {
  onValue(useChatModels());
  return null;
};

describe("ChatModelsProvider", () => {
  it("preserves the context identity when its semantic inputs are unchanged", () => {
    const values: unknown[] = [];
    let renderer: ReturnType<typeof create> | undefined;

    act(() => {
      renderer = create(
        <ChatModelsProvider models={models}>
          <ContextProbe onValue={(value) => values.push(value)} />
        </ChatModelsProvider>
      );
    });

    const rendered = renderer;
    if (!rendered) {
      throw new Error("Expected provider harness to render");
    }

    try {
      act(() => {
        rendered.update(
          <ChatModelsProvider models={models}>
            <ContextProbe onValue={(value) => values.push(value)} />
          </ChatModelsProvider>
        );
      });

      expect(values).toHaveLength(2);
      expect(values[1]).toBe(values[0]);
    } finally {
      act(() => rendered.unmount());
    }
  });
});
