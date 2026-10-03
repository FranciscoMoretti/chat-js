import { parseAsString, parseAsStringEnum } from "nuqs";

const mcpConnectorsDialogValues = ["config", "connect"] as const;

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export type McpConnectorsDialog = (typeof mcpConnectorsDialogValues)[number];
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/**
 * Query params for the /settings/connectors page.
 *
 * - dialog=config: open create/edit dialog (connectorId optional)
 * - dialog=connect: open connect dialog (connectorId required)
 */
export const mcpConnectorsSettingsSearchParams = {
  connectorId: parseAsString,
  dialog: parseAsStringEnum([...mcpConnectorsDialogValues]),
};
/* oxlint-enable import/no-named-export */
