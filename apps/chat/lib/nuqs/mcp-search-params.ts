import { parseAsString } from "nuqs";

const mcpConnectorsDialogValues = ["config", "connect"] as const;

export type McpConnectorsDialog = (typeof mcpConnectorsDialogValues)[number];

/**
 * Query params for the /settings/connectors page.
 *
 * - dialog=config: open create/edit dialog (connectorId optional)
 * - dialog=connect: open connect dialog (connectorId required)
 */
export const mcpConnectorsSettingsSearchParams = {
  connectorId: parseAsString,
  dialog: parseAsString,
};
