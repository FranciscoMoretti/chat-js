import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  createMcpClientForCallback,
  removeMcpClient,
} from "@/lib/ai/mcp/mcp-client";
import { getMcpConnectorById, getSessionByState } from "@/lib/db/mcp-queries";
import { createModuleLogger } from "@/lib/logger";
import { loadMcpOAuthCallbackSearchParams } from "@/lib/nuqs/mcp-search-params.server";

const log = createModuleLogger("mcp-oauth-callback");

export async function GET(request: NextRequest) {
  const {
    code,
    state,
    error,
    error_description: errorDesc,
  } = await loadMcpOAuthCallbackSearchParams(request);

  const redirectToConnector = ({
    connectorId,
    connected,
    errorMessage,
  }: {
    connectorId?: string;
    connected?: boolean;
    errorMessage?: string;
  }) => {
    const path = connectorId
      ? `/settings/connectors/${connectorId}`
      : "/settings/connectors";
    const url = new URL(path, request.nextUrl.origin);
    if (connected) {
      url.searchParams.set("connected", "1");
    }
    if (errorMessage) {
      url.searchParams.set("error", errorMessage);
    }
    return NextResponse.redirect(url);
  };

  log.info(
    { error, hasCode: !!code, hasState: !!state },
    "OAuth callback received"
  );

  if (error) {
    log.error({ error, errorDesc }, "OAuth error from provider");
    const message = `${error}: ${errorDesc ?? "Unknown error"}`;
    return redirectToConnector({ errorMessage: message });
  }

  if (!(code && state)) {
    log.error({ code: !!code, state: !!state }, "Missing code or state");
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
      type: connector.type,
      url: connector.url,
    });

    // Complete the OAuth flow (don't connect first - just exchange the code)
    await mcpClient.finishAuth(code, state);

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
      errorMessage,
    });
  }
}
