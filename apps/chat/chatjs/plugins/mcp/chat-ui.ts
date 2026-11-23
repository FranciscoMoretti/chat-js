"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ComposerExtensions, SettingsLinks } from "@/components/chat-slots";
import { ConnectorsControl } from "./composer";
import { ConnectorsSettingsLink } from "./settings";

export const chatUi = definePlugin({
  id: "mcp",
  slots: [
    slot(ComposerExtensions, ConnectorsControl),
    slot(SettingsLinks, ConnectorsSettingsLink),
  ],
});
