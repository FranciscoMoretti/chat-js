"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ModelSettingsLink } from "@/components/chat-slots";
import { ModelPreferencesLink } from "./settings-link";

export const chatUi = definePlugin({
  id: "model-preferences",
  slots: [slot(ModelSettingsLink, ModelPreferencesLink)],
});
