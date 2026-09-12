"use client";

import { useState } from "react";

import { ModelSelector } from "@/components/model-selector";
import { Toolbar } from "@/components/toolbar";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { gatewayModelDefaults } from "@/lib/ai/gateway-model-defaults";
import type { ChatMessage } from "@/lib/ai/types";
import {
  Provider as ChatStoreProvider,
  useChatStoreApi,
} from "@/lib/stores/base";
import { ChatModelsProvider } from "@/providers/chat-models-provider";

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

const fixtureModels = [
  primaryFixtureModel,
  ...alternativeFixtureModels.filter(
    (model, index, models) =>
      model.id !== primaryFixtureModel.id &&
      models.findIndex(({ id }) => id === model.id) === index
  ),
];

const ToolbarFixture = () => {
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const storeApi = useChatStoreApi<ChatMessage>();

  return (
    <section
      className="bg-muted/20 relative h-64 rounded-lg border p-6"
      data-testid="toolbar-visual-fixture"
    >
      <h2 className="text-sm font-medium">Artifact toolbar</h2>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">
        Hover the toolbar to reveal the deterministic code-artifact actions.
      </p>
      <Toolbar
        artifactKind="code"
        isToolbarVisible={isToolbarVisible}
        setIsToolbarVisible={setIsToolbarVisible}
        status="ready"
        stop={() => Promise.resolve()}
        storeApi={storeApi}
      />
    </section>
  );
};

export const ModelToolbarVisualFixture = () => (
  <ChatModelsProvider models={fixtureModels}>
    <ChatStoreProvider>
      <main
        className="grid max-w-3xl gap-8 p-8"
        data-testid="model-toolbar-fixture"
      >
        <section className="space-y-3 rounded-lg border p-6">
          <h1 className="text-lg font-semibold">Model selector</h1>
          <p className="text-muted-foreground text-sm">
            Fixed fixture models keep visual snapshots independent of gateway
            data.
          </p>
          <ModelSelector
            onModelSelectionChangeAction={() => null}
            selectedModelId={primaryFixtureModel.id}
            selectedModelSelection={primaryFixtureModel.id}
          />
        </section>
        <ToolbarFixture />
      </main>
    </ChatStoreProvider>
  </ChatModelsProvider>
);
