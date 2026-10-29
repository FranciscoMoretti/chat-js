"use client";
import { definePlugin } from "@/lib/ui-slots";
import { ComposerExtensions, SettingsLinks } from "@/components/chat-slots";
import { ConnectorsControl } from "./composer";
import { ConnectorsSettingsLink } from "./settings";

export const mcpClient = definePlugin({
  id: "mcp",
  contributions: [
    ComposerExtensions.contribute(ConnectorsControl),
    SettingsLinks.contribute(ConnectorsSettingsLink),
  ],
});
