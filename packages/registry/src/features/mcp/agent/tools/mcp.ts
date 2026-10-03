import { defineDynamic, defineTool } from "eve/tools";
import type { ToolDefinition } from "eve/tools";
import { parse, stringify } from "superjson";

import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "@/lib/eve/mcp-tools";
import { eveTurnGuest, eveTurnTool } from "@/lib/eve/turn-tools";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.mcp-registration");

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export default defineDynamic({
  events: {
    "step.started": async (_event, context) => {
      if (eveTurnGuest.get() || eveTurnTool.get()) {
        return {};
      }
      const ownerId = context.session.auth.initiator?.principalId;
      const timeoutSignal = AbortSignal.timeout(30_000);
      const discoverySignal = context.abortSignal
        ? AbortSignal.any([context.abortSignal, timeoutSignal])
        : timeoutSignal;
      const tools = await discoverEveMcpTools(ownerId, discoverySignal).catch(
        (error: unknown) => {
          if (timeoutSignal.aborted) {
            log.warn("MCP discovery timed out; continuing without MCP tools");
            return [];
          }
          throw error;
        }
      );
      const messages = stringify(context.messages);
      const definitions: Record<
        string,
        ToolDefinition<
          Record<string, unknown>,
          Awaited<ReturnType<typeof executeEveMcpTool>>
        >
      > = {};
      for (const { name, connectorId, remoteName, ...description } of tools) {
        definitions[name] = defineTool({
          ...description,
          approval: {
            request: (approvalContext) =>
              requestEveMcpApproval(
                connectorId,
                remoteName,
                approvalContext.toolInput,
                approvalContext,
                parse(messages)
              ),
            response: ({ responder, session }) =>
              responder.principalId === session.initiator?.principalId
                ? { status: "allowed" }
                : { reason: "Only the owner may respond", status: "rejected" },
          },
          execute: (input, toolContext) =>
            executeEveMcpTool(
              connectorId,
              remoteName,
              input,
              toolContext,
              parse(messages)
            ),
          toModelOutput: (output) => output.modelOutput,
        });
      }
      return definitions;
    },
  },
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/no-default-export */
