import {
  ChatModelsProvider,
  useChatModels,
} from "@/providers/chat-models-provider";
import { createDomHarness } from "@/components/test-dom-harness";
import { describe, expect, it, vi } from "vitest";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import React, { act } from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";

vi.mock("@tanstack/react-query", () => ({
  useQuery: (): { data: undefined } => ({ data: undefined }),
}));

vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: (
    models: readonly { readonly id: string }[]
  ): Set<string> => new Set(models.map((model) => model.id)),
}));

vi.mock("@/providers/session-provider", () => ({
  useSession: (): { data: null } => ({ data: null }),
}));

vi.mock("@/trpc/react", () => ({
  useTRPC: (): {
    settings: {
      getModelPreferences: { queryOptions: () => Record<string, never> };
    };
  } => ({
    settings: {
      getModelPreferences: {
        queryOptions: (): Record<string, never> => ({}),
      },
    },
  }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const models: AppModelDefinition[] = [];
const updatedModels: AppModelDefinition[] = [
  {
    apiModelId: config.ai.workflows.chat,
    context_window: 128_000,
    description: "Test model",
    id: config.ai.workflows.chat,
    input: {
      audio: false,
      image: false,
      pdf: false,
      text: true,
      video: false,
    },
    max_tokens: 16_000,
    name: "Test model",
    object: "model",
    output: {
      audio: false,
      image: false,
      text: true,
      video: false,
    },
    owned_by: "openai",
    pricing: {},
    reasoning: false,
    toolCall: true,
    type: "language",
  },
];

const ContextProbe = ({
  onValue,
}: {
  readonly onValue: (
    value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
  ) => void;
}): null => {
  onValue(useChatModels());
  return null;
};

describe("ChatModelsProvider", () => {
  it("preserves the context identity when its semantic inputs are unchanged", () => {
    const values: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>[] =
      [];
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ChatModelsProvider models={models}>
          <ContextProbe
            onValue={(
              value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
            ) => {
              values.push(value);
            }}
          />
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
            <ContextProbe
              onValue={(
                value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
              ) => {
                values.push(value);
              }}
            />
          </ChatModelsProvider>
        );
      });

      expect(values).toHaveLength(2);
      expect(values[1]).toBe(values[0]);
    } finally {
      act(() => {
        rendered.unmount();
      });
    }
  });

  it("updates lookup and filtered models when the model input changes", () => {
    const values: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>[] =
      [];
    let renderer: ReturnType<typeof createDomHarness> | undefined;

    act(() => {
      renderer = createDomHarness(
        <ChatModelsProvider models={models}>
          <ContextProbe
            onValue={(
              value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
            ) => {
              values.push(value);
            }}
          />
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
            <ContextProbe
              onValue={(
                value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
              ) => {
                values.push(value);
              }}
            />
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
      act(() => {
        rendered.unmount();
      });
    }
  });
});
