import { isAccountSession } from "@/lib/eve/session-identity";
import type { ToolDefinition, ToolModelOutput } from "eve/tools";
import { defineDynamic, defineTool } from "eve/tools";
import { parse, stringify } from "superjson";

import {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
} from "@/chatjs/plugins/mcp/runtime/mcp-tools";
import { eveTurnAccount, eveTurnTool } from "@/lib/eve/turn-tools";
import type { McpToolContext } from "@/chatjs/plugins/mcp/runtime/mcp-tools";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.mcp-registration");

const mcpTools = defineDynamic(
  async (
    context: Readonly<{
      session: Readonly<Pick<McpToolContext["session"], "id" | "auth">>;
      abortSignal?: Readonly<AbortSignal>;
      messages: () => Promise<readonly unknown[]>;
    }>
  ) => {
    if (
      !isAccountSession(context.session) ||
      !eveTurnAccount.get() ||
      eveTurnTool.get() !== null
    ) {
      return {};
    }
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
    const messages = stringify(await context.messages());
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
          request: async (
            approvalContext: Readonly<
              Pick<McpToolContext, "session" | "abortSignal"> & {
                toolInput?: unknown;
              }
            >
          ) =>
            await requestEveMcpApproval(
              connectorId,
              remoteName,
              approvalContext.toolInput,
              approvalContext
            ),
          response: ({
            response,
            session,
          }: {
            readonly response: Readonly<{
              principal: Readonly<{ principalId: string }>;
            }>;
            readonly session: Readonly<{
              initiator: Readonly<{ principalId: string }> | null;
            }>;
          }) => {
            if (
              response.principal.principalId === session.initiator?.principalId
            ) {
              return { status: "allowed" };
            }
            return {
              reason: "Only the owner may respond",
              status: "rejected",
            };
          },
        },
        execute: async (
          input: Readonly<Record<string, unknown>>,
          toolContext: McpToolContext
        ) =>
          await executeEveMcpTool(
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
  }
);

export { mcpTools };
