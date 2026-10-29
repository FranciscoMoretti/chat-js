"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { ModelSettingsLink } from "@/components/chat-slots";
import { ModelPreferencesLink } from "./settings-link";
import { useModelPreferences } from "./use-model-preferences";

export const modelPreferencesClient = definePlugin({
  id: "model-preferences",
  slots: [slot(ModelSettingsLink, ModelPreferencesLink)],
  useModelVisibility: useModelPreferences,
});
