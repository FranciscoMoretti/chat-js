import { asSchema, jsonSchema, type ModelMessage, type Tool } from "ai";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ToolContext } from "eve/tools";
import { MCPClient } from "../ai/mcp/mcp-client";
import { createToolId } from "../ai/mcp-name-id";
import { config } from "../config";
import {
  getMcpConnectorById,
  getMcpConnectorsByUserId,
} from "../db/mcp-queries";
import type { McpConnector } from "../db/schema";
import { createModuleLogger } from "../logger";
import { describeEveTool, executeEveTool } from "./adapt-tool";

import { eveMcpResult } from "./mcp-result";

const log = createModuleLogger("eve.mcp");

function assertConnector(connector: McpConnector | undefined, ownerId: string) {
  if (
    !(
      config.ai.tools.mcp.enabled &&
      connector?.enabled &&
      (connector.userId === ownerId || connector.userId === null)
    )
  ) {
    throw new Error("MCP connector is unavailable.");
  }
  return connector;
}

async function withConnector<T>(
  connector: McpConnector,
  signal: AbortSignal,
  run: (tools: Record<string, Tool>) => Promise<T>
) {
  signal.throwIfAborted();
  const client = new MCPClient(connector.id, connector.name, {
    url: connector.url,
    type: connector.type,
    headers:
      connector.oauthClientId && connector.oauthClientSecret
        ? {
            Authorization: `Basic ${Buffer.from(`${connector.oauthClientId}:${connector.oauthClientSecret}`).toString("base64")}`,
          }
        : undefined,
  });
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= client.close();
    return closing;
  };
  const cancel = close;
  try {
    await client.connect(undefined, signal);
    signal.throwIfAborted();
    signal.addEventListener("abort", cancel, { once: true });
    if (client.status !== "connected") {
      throw new Error(
        "Connect this MCP server in settings before using its tools."
      );
    }
    const tools = await client.tools();
    signal.throwIfAborted();
    return await run(tools);
  } finally {
    signal.removeEventListener("abort", cancel);
    await close();
  }
}

/** Only serializable descriptions leave discovery; no credentials or open clients enter a workflow closure. */
export async function discoverEveMcpTools(
  ownerId: string | undefined,
  signal: AbortSignal
) {
  if (!(ownerId && config.ai.tools.mcp.enabled)) {
    return [];
  }
  const connectors = await getMcpConnectorsByUserId({ userId: ownerId });
  const descriptions: Array<
    Awaited<ReturnType<typeof describeEveTool>> & {
      name: string;
      connectorId: string;
      remoteName: string;
    }
  > = [];
  for (const connector of connectors) {
    signal.throwIfAborted();
    if (!connector.enabled) {
      continue;
    }
    try {
      await withConnector(
        assertConnector(connector, ownerId),
        signal,
        async (tools) => {
          for (const [remoteName, tool] of Object.entries(tools)) {
            // MCP output and approval policies are adapted explicitly below.
            const {
              toModelOutput: _outputAdapter,
              needsApproval: _approval,
              ...definition
            } = tool;
            descriptions.push({
              ...(await describeEveTool(definition)),
              connectorId: connector.id,
              remoteName,
              name: createToolId(
                connector.nameId,
                remoteName,
                connector.userId === null
              ),
            });
          }
        }
      );
    } catch {
      signal.throwIfAborted();
      log.warn({ connectorId: connector.id }, "MCP discovery unavailable");
    }
  }
  return descriptions;
}

export async function executeEveMcpTool(
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal" | "approval">,
  messages: readonly ModelMessage[]
) {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!ownerId) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  context.abortSignal.throwIfAborted();
  const connector = assertConnector(
    await getMcpConnectorById({ id: connectorId }),
    ownerId
  );
  return await withConnector(connector, context.abortSignal, async (tools) => {
    if (!Object.hasOwn(tools, remoteName)) {
      throw new Error("MCP tool is no longer available.");
    }
    const tool = tools[remoteName];
    const validatedTool = await validateMcpTool(tool);
    if (
      (await requiresMcpApproval(
        validatedTool,
        input,
        context.callId,
        messages
      )) &&
      context.approval?.responder.principalId !== ownerId
    ) {
      throw new Error("MCP approval policy changed; retry after rediscovery.");
    }
    let result: unknown;
    for await (const output of executeEveTool(
      validatedTool,
      input,
      context,
      messages
    )) {
      result = output;
    }
    const converted = tool.toModelOutput
      ? await tool.toModelOutput({
          toolCallId: context.callId,
          input,
          output: result,
        })
      : { type: "json", value: result };
    return eveMcpResult.parse({
      kind: "chatjs.mcp-result",
      output: result,
      modelOutput: converted,
    });
  });
}

async function validateMcpTool(tool: Tool) {
  const schema = await asSchema(tool.inputSchema).jsonSchema;
  // MCP defaults to 2020-12; retain explicitly declared draft-07 schemas.
  const Validator =
    schema.$schema === "http://json-schema.org/draft-07/schema#"
      ? Ajv
      : Ajv2020;
  const validate = new Validator({
    strict: false,
    validateFormats: false,
  }).compile(schema);
  return {
    ...tool,
    inputSchema: jsonSchema(schema, {
      validate: (value) =>
        validate(value)
          ? { success: true, value }
          : { success: false, error: new Error("Invalid tool input.") },
    }),
  };
}

/** Native request evaluation; only serializable identifiers enter durable callbacks. */
export async function requestEveMcpApproval(
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId">,
  messages: readonly ModelMessage[]
): Promise<"user-approval" | "not-applicable"> {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!ownerId) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  const connector = assertConnector(
    await getMcpConnectorById({ id: connectorId }),
    ownerId
  );
  return await withConnector(
    connector,
    AbortSignal.timeout(30_000),
    async (tools) => {
      if (!Object.hasOwn(tools, remoteName)) {
        throw new Error("MCP tool is no longer available.");
      }
      return (await requiresMcpApproval(
        await validateMcpTool(tools[remoteName]),
        input,
        context.callId,
        messages
      ))
        ? "user-approval"
        : "not-applicable";
    }
  );
}

async function requiresMcpApproval(
  tool: Tool,
  input: unknown,
  callId: string,
  messages: readonly ModelMessage[]
) {
  const validated = await asSchema(tool.inputSchema).validate?.(input);
  if (!validated?.success) {
    throw new Error("Invalid tool input.");
  }
  return typeof tool.needsApproval === "function"
    ? await tool.needsApproval(validated.value, {
        toolCallId: callId,
        messages: [...messages],
        context: undefined,
      })
    : Boolean(tool.needsApproval);
}
