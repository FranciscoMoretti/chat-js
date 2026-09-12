import { defineDynamic, defineTool } from "eve/tools";
import superjson from "superjson";
import { eveMcpResult } from "../../lib/eve/mcp-result";
import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "../../lib/eve/mcp-tools";
import { eveTurnGuest, eveTurnTool } from "../../lib/eve/turn-tools";
import { createModuleLogger } from "../../lib/logger";

const log = createModuleLogger("eve.mcp-registration");

export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      if (eveTurnGuest.get() || eveTurnTool.get()) {
        return {};
      }
      const ownerId = context.session.auth.initiator?.principalId;
      // Dynamic resolvers do not expose EVE's execution cancellation signal.
      const discoverySignal = AbortSignal.timeout(30_000);
      const tools = await discoverEveMcpTools(ownerId, discoverySignal).catch(
        (error: unknown) => {
          if (discoverySignal.aborted) {
            log.warn("MCP discovery timed out; continuing without MCP tools");
            return [];
          }
          throw error;
        }
      );
      const messages = superjson.stringify(context.messages);
      const definitions: Record<string, ReturnType<typeof defineTool>> = {};
      for (const { name, connectorId, remoteName, ...description } of tools) {
        definitions[name] = defineTool<unknown, unknown>({
          ...description,
          approval: {
            request: (approvalContext) =>
              requestEveMcpApproval(
                connectorId,
                remoteName,
                approvalContext.toolInput,
                approvalContext,
                superjson.parse(messages)
              ),
            response: ({ responder, session }) =>
              responder.principalId === session.initiator?.principalId
                ? { status: "allowed" }
                : { status: "rejected", reason: "Only the owner may respond" },
          },
          execute: (input, toolContext) =>
            executeEveMcpTool(
              connectorId,
              remoteName,
              input,
              toolContext,
              superjson.parse(messages)
            ),
          toModelOutput: (output) => eveMcpResult.parse(output).modelOutput,
        });
      }
      return definitions;
    },
  },
});
