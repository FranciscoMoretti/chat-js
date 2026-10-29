"use client";
import { definePlugin } from "@/lib/ui-slots";
import { ModelSettingsLink } from "@/components/chat-slots";
import { ModelPreferencesLink } from "./settings-link";
import { useModelPreferences } from "./use-model-preferences";

export const modelPreferencesClient = definePlugin({
  id: "model-preferences",
  contributions: [ModelSettingsLink.contribute(ModelPreferencesLink)],
  useModelVisibility: useModelPreferences,
});
