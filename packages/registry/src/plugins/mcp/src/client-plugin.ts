import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { ConnectorsControl } from "./composer";
import { mcpSettingsItem } from "./settings";

export const mcpClient = () =>
  ({
    id: "mcp",
    composerControls: [{ Component: ConnectorsControl, id: "mcp" }],
    settingsItems: [mcpSettingsItem],
  }) satisfies ChatClientPlugin;
