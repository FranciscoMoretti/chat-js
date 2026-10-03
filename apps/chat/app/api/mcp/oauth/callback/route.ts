import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMcpCredentials } from "@/features/mcp/setup";
import { invalidateAllMcpCaches } from "@/lib/ai/mcp/cache";
import {
  createMcpClientForCallback,
  removeMcpClient,
} from "@/lib/ai/mcp/mcp-client-manager";
import {
  deletePendingSessionByState,
  getMcpConnectorById,
  getSessionByState,
} from "@/lib/db/mcp-queries";
import { createModuleLogger } from "@/lib/logger";
import { loadMcpOAuthCallbackSearchParams } from "@/lib/nuqs/mcp-search-params.server";
import { MissingCredentialsError } from "@/lib/required-credentials";

const hasNonEmptyValue = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const log = createModuleLogger("mcp-oauth-callback");

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const {
    code,
    state,
    error,
    error_description: errorDesc,
    // oxlint-disable-next-line typescript/await-thenable -- Keep the callback loader await boundary shared with the asynchronous route flow; changing search-parameter loader timing is outside this lint cleanup.
  } = await loadMcpOAuthCallbackSearchParams(request);

  const redirectToConnector = ({
    connectorId,
    connected,
    errorMessage,
  }: {
    connectorId?: string;
    connected?: boolean;
    errorMessage?: string;
  }): NextResponse => {
    const path = hasNonEmptyValue(connectorId)
      ? `/settings/connectors/${connectorId}`
      : "/settings/connectors";
    const url = new URL(path, request.nextUrl.origin);
    if (connected === true) {
      url.searchParams.set("connected", "1");
    }
    if (hasNonEmptyValue(errorMessage)) {
      url.searchParams.set("error", errorMessage);
    }
    return NextResponse.redirect(url);
  };

  log.info(
    { error, hasCode: Boolean(code), hasState: Boolean(state) },
    "OAuth callback received"
  );

  try {
    requireMcpCredentials();
  } catch (setupError) {
    if (setupError instanceof MissingCredentialsError) {
      return redirectToConnector({ errorMessage: setupError.message });
    }
    throw setupError;
  }

  if (hasNonEmptyValue(error)) {
    log.error({ error, errorDesc }, "OAuth error from provider");
    const pending = hasNonEmptyValue(state)
      ? await getSessionByState({ state })
      : undefined;
    if (pending && !pending.tokens && hasNonEmptyValue(state)) {
      const deleted = await deletePendingSessionByState({ state });
      if (deleted) {
        await removeMcpClient(deleted.mcpConnectorId, state);
        invalidateAllMcpCaches(deleted.mcpConnectorId);
      }
    }
    return redirectToConnector({
      connectorId: pending?.mcpConnectorId,
      errorMessage:
        "Authorization was not completed. Please try connecting again.",
    });
  }
  if (!(hasNonEmptyValue(code) && hasNonEmptyValue(state))) {
    log.error(
      { code: Boolean(code), state: Boolean(state) },
      "Missing code or state"
    );
    return redirectToConnector({
      errorMessage: "Missing authorization code or state parameter",
    });
  }

  // Look up the session by state
  const session = await getSessionByState({ state });

  if (!session) {
    log.error({ state }, "Session not found for state");
    return redirectToConnector({
      errorMessage: "Invalid or expired session. Please try again.",
    });
  }

  // Get the connector to get its configuration
  const connector = await getMcpConnectorById({ id: session.mcpConnectorId });
  if (!connector) {
    log.error({ connectorId: session.mcpConnectorId }, "Connector not found");
    return redirectToConnector({ errorMessage: "MCP connector not found" });
  }

  try {
    // Create a fresh MCP client for callback handling
    // Don't use cached client - it might have stale/different state
    const mcpClient = createMcpClientForCallback({
      id: connector.id,
      name: connector.name,
      oauthClientId: connector.oauthClientId,
      oauthClientSecret: connector.oauthClientSecret,
      type: connector.type,
      url: connector.url,
    });

    // Complete the OAuth flow (don't connect first - just exchange the code)
    await mcpClient.finishAuth(code, state);
    invalidateAllMcpCaches(connector.id);

    log.info(
      { connectorId: connector.id },
      "OAuth flow completed successfully"
    );

    // Important: clear any cached MCP client that might be stuck in `authorizing`
    // from a pre-auth discovery attempt. Tokens are saved by finishAuth, but
    // cached clients may still keep an authorization URL in memory.
    await removeMcpClient(connector.id);

    return redirectToConnector({
      connected: true,
      connectorId: connector.id,
    });
  } catch (oauthError) {
    const errorMessage =
      oauthError instanceof Error
        ? oauthError.message
        : "Token exchange failed";
    log.error(
      {
        connectorId: connector.id,
        error: oauthError,
        errorMessage,
        errorStack: oauthError instanceof Error ? oauthError.stack : undefined,
      },
      "OAuth token exchange failed"
    );

    return redirectToConnector({
      connectorId: connector.id,
      errorMessage:
        "Could not complete connector authorization. Please try again.",
    });
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
