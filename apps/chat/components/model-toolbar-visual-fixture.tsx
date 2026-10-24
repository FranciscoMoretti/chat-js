"use client";

import type { AppModelDefinition } from "@/lib/ai/app-models";

import { ModelSelector } from "@/components/model-selector";
import { ChatModelsProvider } from "@/providers/chat-models-provider";

import React from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";

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
  createModel(gatewayModelDefaults.roles.balanced, "Reasoning fixture model", {
    reasoning: true,
    toolCall: true,
  }),
  createModel(
    gatewayModelDefaults.workflows.chatImageCompatible,
    "Alternative fixture model",
    { reasoning: false, toolCall: true }
  ),
];

const fixtureModels = [
  primaryFixtureModel,
  ...alternativeFixtureModels.filter(
    (
      model: Readonly<Pick<AppModelDefinition, "id">>,
      index,
      models: readonly ReadonlyNativeSurface<AppModelDefinition>[]
    ) =>
      model.id !== primaryFixtureModel.id &&
      models.findIndex(({ id }) => id === model.id) === index
  ),
];

const ignoreModelSelectionChange = (): void => {
  // This fixture has no selection-change subscription to clean up.
};

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
          onModelSelectionChangeAction={ignoreModelSelectionChange}
          selectedModelId={primaryFixtureModel.id}
          selectedModelSelection={primaryFixtureModel.id}
        />
      </section>
    </main>
  </ChatModelsProvider>
);
