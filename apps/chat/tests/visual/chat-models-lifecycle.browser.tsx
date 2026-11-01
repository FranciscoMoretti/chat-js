import {
  ChatModelsProvider,
  useChatModels,
} from "@/providers/chat-models-provider";
import { createDomHarness } from "@/components/test-dom-harness";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import React, { act } from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";

const preferenceState = vi.hoisted(() => {
  const state: {
    authenticated: boolean;
    preferences: { modelId: string; enabled: boolean }[] | undefined;
    queryEnabled: boolean;
  } = { authenticated: false, preferences: undefined, queryEnabled: false };
  return state;
});
beforeEach(() => {
  preferenceState.authenticated = false;
  preferenceState.preferences = undefined;
  preferenceState.queryEnabled = false;
});
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { readonly enabled: boolean }) => {
    preferenceState.queryEnabled = options.enabled;
    return { data: preferenceState.preferences };
  },
}));

vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: (
    models: readonly { readonly id: string }[]
  ): Set<string> => new Set(models.map((model) => model.id)),
}));

vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({
    data: preferenceState.authenticated ? { user: { id: "fixture" } } : null,
  }),
}));

vi.mock("@/trpc/react", () => ({
  useTRPC: (): {
    modelPreferences: {
      getModelPreferences: { queryOptions: () => Record<string, never> };
    };
  } => ({
    modelPreferences: {
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

it("preferences filter visibility without changing the catalog, and cached preferences do not affect guests", () => {
  preferenceState.authenticated = true;
  preferenceState.preferences = [
    { modelId: config.ai.workflows.chat, enabled: false },
    { modelId: "unavailable-model", enabled: true },
  ];
  const values: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>[] = [];
  const probe = (
    <ChatModelsProvider models={updatedModels}>
      <ContextProbe
        onValue={(value) => {
          values.push(value);
        }}
      />
    </ChatModelsProvider>
  );
  let renderer: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    renderer = createDomHarness(probe);
  });
  const rendered = renderer;
  if (!rendered) {
    throw new Error("Expected provider harness");
  }
  try {
    expect(preferenceState.queryEnabled).toBe(true);
    expect(values.at(-1)?.models).toEqual([]);
    expect(values.at(-1)?.allModels).toBe(updatedModels);
    expect(values.at(-1)?.getModelById(config.ai.workflows.chat)).toBe(
      updatedModels[0]
    );
    preferenceState.authenticated = false;
    act(() => {
      rendered.update(
        <ChatModelsProvider models={updatedModels}>
          <ContextProbe
            onValue={(value) => {
              values.push(value);
            }}
          />
        </ChatModelsProvider>
      );
    });
    expect(preferenceState.queryEnabled).toBe(false);
    expect(values.at(-1)?.models).toEqual(updatedModels);
  } finally {
    act(() => {
      rendered.unmount();
    });
  }
});
