import type { ToolDefinition, ToolModelOutput } from "eve/tools";
import { defineDynamic, defineTool } from "eve/tools";
import { parse, stringify } from "superjson";

/* oxlint-disable-next-line sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "@/lib/eve/mcp-tools";
import type { McpToolContext } from "@/lib/eve/mcp-tools";
import { eveTurnGuest, eveTurnTool } from "@/lib/eve/turn-tools";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.mcp-registration");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export default defineDynamic({
  events: {
    "step.started": async (
      _event,
      context: Readonly<{
        session: Readonly<Pick<McpToolContext["session"], "id" | "auth">>;
        abortSignal?: Readonly<AbortSignal>;
        messages: readonly unknown[];
      }>
    ) => {
      if (eveTurnGuest.get() || eveTurnTool.get()) {
        return {};
      }
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      const ownerId = context.session.auth.initiator?.principalId;
      const timeoutSignal = AbortSignal.timeout(30_000);
      const discoverySignal =
        (context.abortSignal &&
          AbortSignal.any([context.abortSignal, timeoutSignal])) ??
        timeoutSignal;
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding description excludes name, connectorId, remoteName from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
      for (const { name, connectorId, remoteName, ...description } of tools) {
        definitions[name] = defineTool({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing description own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...description,
          approval: {
            request: (
              approvalContext: Readonly<
                Pick<McpToolContext, "session" | "abortSignal"> & {
                  toolInput?: unknown;
                }
              >
            ) =>
              requestEveMcpApproval(
                connectorId,
                remoteName,
                approvalContext.toolInput,
                approvalContext
              ),
            response: ({
              responder,
              session,
            }: {
              readonly responder: Readonly<{ principalId: string }>;
              readonly session: Readonly<{
                initiator: Readonly<{ principalId: string }> | null;
              }>;
            }) => {
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from session.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
              if (responder.principalId === session.initiator?.principalId) {
                return { status: "allowed" };
              }
              return {
                reason: "Only the owner may respond",
                status: "rejected",
              };
            },
          },
          execute: (
            input: Readonly<Record<string, unknown>>,
            toolContext: McpToolContext
          ) =>
            executeEveMcpTool(
              connectorId,
              remoteName,
              input,
              toolContext,
              parse(messages)
            ),
          toModelOutput: (output: Readonly<{ modelOutput: ToolModelOutput }>) =>
            output.modelOutput,
        });
      }
      return definitions;
    },
  },
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/no-default-export */
