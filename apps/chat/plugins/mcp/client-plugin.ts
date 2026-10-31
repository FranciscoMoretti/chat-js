"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { ComposerExtensions, SettingsLinks } from "@/components/chat-slots";
import { ConnectorsControl } from "./composer";
import { ConnectorsSettingsLink } from "./settings";

export const mcpClient = definePlugin({
  id: "mcp",
  slots: [
    slot(ComposerExtensions, ConnectorsControl),
    slot(SettingsLinks, ConnectorsSettingsLink),
  ],
});
