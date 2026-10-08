import { ChatModelsProvider, useChatModels } from "./chat-models-provider";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { config } from "@/lib/config";

/* oxlint-disable no-undefined --
 * no-undefined (#519): vi.mock("@tanstack/react-query") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
vi.mock("@tanstack/react-query", () => ({
  useQuery: (): { data: undefined } => ({ data: undefined }),
}));
/* oxlint-enable no-undefined */

vi.mock("@/lib/ai/app-models", () => ({
  getDefaultEnabledModels: (
    models: readonly { readonly id: string }[]
  ): Set<string> => new Set(models.map((model) => model.id)),
}));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): vi.mock("@/providers/session-provider") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("@/providers/session-provider", () => ({
  useSession: (): { data: null } => ({ data: null }),
}));
/* oxlint-enable unicorn/no-null */

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

/* oxlint-disable unicorn/no-null -- ContextProbe returns the existing React empty-render sentinel; undefined changes its public return contract. */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, typescript/strict-void-return -- * init-declarations (#507): describe("ChatModelsProvider") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): describe("ChatModelsProvider") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): describe("ChatModelsProvider") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): describe("ChatModelsProvider") uses 2, 1, 0, -1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * react-perf/jsx-no-new-function-as-prop (#557): describe("ChatModelsProvider") creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * typescript/strict-void-return (#611): describe("ChatModelsProvider")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary. */
describe("ChatModelsProvider", () => {
  it("preserves the context identity when its semantic inputs are unchanged", () => {
    const values: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>[] =
      [];
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ChatModelsProvider models={models}>
          <ContextProbe
            onValue={(
              value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
            ) => values.push(value)}
          />
        </ChatModelsProvider>
      );
    });

    const rendered = renderer;
    if (!rendered) {
      throw new Error("Expected provider harness to render");
    }

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => {
        rendered.update(
          <ChatModelsProvider models={models}>
            <ContextProbe
              onValue={(
                value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
              ) => values.push(value)}
            />
          </ChatModelsProvider>
        );
      });

      expect(values).toHaveLength(2);
      expect(values[1]).toBe(values[0]);
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => rendered.unmount());
    }
  });

  it("updates lookup and filtered models when the model input changes", () => {
    const values: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>[] =
      [];
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    let renderer: ReturnType<typeof create> | undefined;

    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    act(() => {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      renderer = create(
        <ChatModelsProvider models={models}>
          <ContextProbe
            onValue={(
              value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
            ) => values.push(value)}
          />
        </ChatModelsProvider>
      );
    });

    const rendered = renderer;
    if (!rendered) {
      throw new Error("Expected provider harness to render");
    }

    try {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => {
        rendered.update(
          <ChatModelsProvider models={updatedModels}>
            <ContextProbe
              onValue={(
                value: ReadonlyNativeSurface<ReturnType<typeof useChatModels>>
              ) => values.push(value)}
            />
          </ChatModelsProvider>
        );
      });

      const updatedValue = values.at(-1);
      expect(updatedValue).not.toBe(values[0]);
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading models from updatedValue; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      expect(updatedValue?.models).toEqual(updatedModels);
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading getModelById from updatedValue; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      expect(updatedValue?.getModelById(config.ai.workflows.chat)).toBe(
        updatedModels[0]
      );
    } finally {
      // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
      act(() => rendered.unmount());
    }
  });
});
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, typescript/strict-void-return */
