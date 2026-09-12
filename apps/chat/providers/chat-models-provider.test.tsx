import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { AppModelDefinition } from "@/lib/ai/app-models";
import { models as generatedModels } from "@/lib/ai/models.generated";
import { config } from "@/lib/config";

import { ChatModelsProvider, useChatModels } from "./chat-models-provider";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: (models: { id: string }[]) =>
    new Set(models.map((model) => model.id)),
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
const testModel = generatedModels.find((model) => model.type === "language");

if (!testModel) {
  throw new Error("Expected a language model in the generated model snapshot");
}

const updatedModels: AppModelDefinition[] = [
  {
    ...testModel,
    apiModelId: config.ai.workflows.chat,
    id: config.ai.workflows.chat,
  },
];

const ContextProbe = ({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useChatModels>) => void;
}) => {
  onValue(useChatModels());
  return null;
};

describe("ChatModelsProvider", () => {
  it("preserves the context identity when its semantic inputs are unchanged", () => {
    const values: ReturnType<typeof useChatModels>[] = [];
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

  it("updates lookup and filtered models when the model input changes", () => {
    const values: ReturnType<typeof useChatModels>[] = [];
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
          <ChatModelsProvider models={updatedModels}>
            <ContextProbe onValue={(value) => values.push(value)} />
          </ChatModelsProvider>
        );
      });

      const updatedValue = values.at(-1);
      expect(updatedValue).not.toBe(values[0]);
      expect(updatedValue?.models).toEqual(updatedModels);
      expect(updatedValue?.getModelById(config.ai.workflows.chat)).toBe(
        updatedModels[0]
      );
    } finally {
      act(() => rendered.unmount());
    }
  });
});
