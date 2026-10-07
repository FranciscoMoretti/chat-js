import { parseAsString, parseAsStringEnum } from "nuqs";

const mcpConnectorsDialogValues = ["config", "connect"] as const;

/* oxlint-disable import/no-named-export -- Keep the named type bindings (McpConnectorsDialog); the enabled import/no-default-export convention rejects the default-export alternative. */
export type McpConnectorsDialog = (typeof mcpConnectorsDialogValues)[number];
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (mcpConnectorsSettingsSearchParams); the enabled import/no-default-export convention rejects the default-export alternative. */
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
