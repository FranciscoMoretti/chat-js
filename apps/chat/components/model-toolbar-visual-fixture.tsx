"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { ModelSelector } from "@/components/model-selector";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals -- ModelToolbarVisualFixture: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals */
