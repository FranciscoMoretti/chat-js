"use client";

import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ModelSelector } from "@/components/model-selector";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { AppModelDefinition } from "@/lib/ai/app-models";
/* oxlint-enable sort-imports */
import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ChatModelsProvider } from "@/providers/chat-models-provider";
/* oxlint-enable sort-imports */

const defaultModelOptions: Pick<AppModelDefinition, "reasoning" | "toolCall"> =
  {
    reasoning: false,
    toolCall: false,
  };

const createModel = (
  id: AppModelDefinition["id"],
  name: string,
  options: Pick<
    AppModelDefinition,
    "reasoning" | "toolCall"
  > = defaultModelOptions
): AppModelDefinition => ({
  apiModelId: id,
  context_window: 128_000,
  description: `${name} fixture model`,
  id,
  input: {
    audio: false,
    image: false,
    pdf: false,
    text: true,
    video: false,
  },
  max_tokens: 16_384,
  name,
  object: "model",
  output: {
    audio: false,
    image: false,
    text: true,
    video: false,
  },
  owned_by: "openai",
  pricing: {},
  reasoning: options.reasoning,
  toolCall: options.toolCall,
  type: "language",
});

const primaryFixtureModel = createModel(
  gatewayModelDefaults.workflows.title,
  "Primary fixture model"
);

const alternativeFixtureModels = [
  createModel(
    gatewayModelDefaults.tools.code.edits,
    "Reasoning fixture model",
    {
      reasoning: true,
      toolCall: true,
    }
  ),
  createModel(
    gatewayModelDefaults.workflows.chatImageCompatible,
    "Alternative fixture model",
    { reasoning: false, toolCall: true }
  ),
];
/* oxlint-disable typescript/prefer-readonly-parameter-types -- fixtureModels: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including model). */

const fixtureModels = [
  primaryFixtureModel,
  ...alternativeFixtureModels.filter(
    (model, index, models) =>
      model.id !== primaryFixtureModel.id &&
      models.findIndex(({ id }) => id === model.id) === index
  ),
];
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelToolbarVisualFixture); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ModelToolbarVisualFixture renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- ModelToolbarVisualFixture: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const ModelToolbarVisualFixture = (): React.JSX.Element => (
  <ChatModelsProvider models={fixtureModels}>
    <main
      className="h-[32rem] w-[48rem] p-8"
      data-testid="model-toolbar-fixture"
    >
      <section className="space-y-3 rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Model selector</h1>
        <p className="text-muted-foreground text-sm">
          Fixed fixture models keep visual snapshots independent of gateway
          data.
        </p>
        <ModelSelector
          onModelSelectionChangeAction={() => {
            // This capability has no subscription to clean up.
          }}
          selectedModelId={primaryFixtureModel.id}
          selectedModelSelection={primaryFixtureModel.id}
        />
      </section>
    </main>
  </ChatModelsProvider>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
