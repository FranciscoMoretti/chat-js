import { createHash } from "node:crypto";

import { asSchema, jsonSchema } from "ai";
import type { ModelMessage, Tool } from "ai";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ToolContext } from "eve/tools";

import { installedFeatures } from "@/features/installed";
import { requireMcpCredentials } from "@/features/mcp/setup";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { MCPClient } from "@/lib/ai/mcp/mcp-client";
import {
  getMcpConnectorById,
  getMcpConnectorsByUserId,
} from "@/lib/db/mcp-queries";
import type { McpConnector } from "@/lib/db/schema";
import { describeMcpTool, executeMcpTool } from "@/lib/eve/mcp-adapter";
import { eveMcpResult } from "@/lib/eve/mcp-result";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.mcp");

const VALID_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/u;
const UNSAFE_TOOL_NAME = /[^a-zA-Z0-9_-]/gu;
const modelToolName = (name: string) =>
  VALID_TOOL_NAME.test(name)
    ? name
    : `${name.replace(UNSAFE_TOOL_NAME, "_").slice(0, 51)}_${createHash("sha256").update(name).digest("hex").slice(0, 12)}`;

const withAbort = async <T>(
  operation: () => Promise<T>,
  signal: AbortSignal
): Promise<T> => {
  signal.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  const cancel = () => aborted.reject(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  try {
    return await Promise.race([operation(), aborted.promise]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
};

const assertConnector = (
  connector: McpConnector | undefined,
  ownerId: string
) => {
  if (
    !(
      installedFeatures.has("mcp") &&
      connector?.enabled &&
      (connector.userId === ownerId || connector.userId === null)
    )
  ) {
    throw new Error("MCP connector is unavailable.");
  }
  requireMcpCredentials();
  return connector;
};

const withConnector = async <T>(
  connector: McpConnector,
  signal: AbortSignal,
  run: (tools: Record<string, Tool>) => Promise<T>
) => {
  signal.throwIfAborted();
  const client = new MCPClient(connector.id, connector.name, {
    oauthClientId: connector.oauthClientId,
    oauthClientSecret: connector.oauthClientSecret,
    type: connector.type,
    url: connector.url,
  });
  let closing: Promise<void> | undefined;
  const close = () => {
    closing ??= client.close();
    return closing;
  };
  const cancel = () => {
    void close();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await withAbort(() => client.connect(undefined, signal), signal);
    signal.throwIfAborted();
    if (client.status !== "connected") {
      throw new Error(
        "Connect this MCP server in settings before using its tools."
      );
    }
    const tools = await withAbort(() => client.tools(), signal);
    signal.throwIfAborted();
    return await withAbort(() => run(tools), signal);
  } finally {
    signal.removeEventListener("abort", cancel);
    await close();
  }
};

/** Only serializable descriptions leave discovery; no credentials or open clients enter a workflow closure. */
export const discoverEveMcpTools = async (
  ownerId: string | undefined,
  signal: AbortSignal
) => {
  if (!(ownerId && installedFeatures.has("mcp"))) {
    return [];
  }
  requireMcpCredentials();
  const connectors = await withAbort(
    () => getMcpConnectorsByUserId({ userId: ownerId }),
    signal
  );
  const descriptions: (Awaited<ReturnType<typeof describeMcpTool>> & {
    name: string;
    connectorId: string;
    remoteName: string;
  })[] = [];
  for (const connector of connectors) {
    if (
      signal.aborted &&
      signal.reason instanceof DOMException &&
      signal.reason.name === "TimeoutError"
    ) {
      break;
    }
    signal.throwIfAborted();
    if (!connector.enabled) {
      continue;
    }
    const connectorSignal = AbortSignal.any([
      signal,
      AbortSignal.timeout(10_000),
    ]);
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Finish the scoped connector operation before releasing its client.
      await withConnector(
        assertConnector(connector, ownerId),
        connectorSignal,
        async (tools) => {
          for (const [remoteName, tool] of Object.entries(tools)) {
            try {
              // MCP output and approval policies are adapted explicitly below.
              const {
                toModelOutput: _outputAdapter,
                needsApproval: _approval,
                ...definition
              } = tool;
              // oxlint-disable-next-line no-await-in-loop -- Each connector has a bounded discovery window.
              const description = await describeMcpTool(definition);
              connectorSignal.throwIfAborted();
              descriptions.push({
                ...description,
                connectorId: connector.id,
                name: modelToolName(
                  createToolId(
                    connector.nameId,
                    remoteName,
                    connector.userId === null
                  )
                ),
                remoteName,
              });
            } catch {
              log.warn(
                { connectorId: connector.id, remoteName },
                "Unsupported MCP tool schema"
              );
            }
          }
        }
      );
    } catch {
      if (
        signal.aborted &&
        signal.reason instanceof DOMException &&
        signal.reason.name === "TimeoutError"
      ) {
        break;
      }
      signal.throwIfAborted();
      log.warn({ connectorId: connector.id }, "MCP discovery unavailable");
    }
  }
  return descriptions;
};

const validateMcpTool = async (tool: Tool) => {
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
          : {
              error: new Error(
                `Invalid tool input: ${
                  validate.errors
                    ?.slice(0, 3)
                    .map(
                      (error) => `${error.instancePath || "/"} ${error.message}`
                    )
                    .join("; ") ?? "schema validation failed"
                }`
              ),
              success: false,
            },
    }),
  };
};

const requiresMcpApproval = async (
  tool: Tool,
  input: unknown,
  callId: string,
  messages: readonly ModelMessage[]
) => {
  const validated = await asSchema(tool.inputSchema).validate?.(input);
  if (!validated?.success) {
    throw validated && !validated.success
      ? validated.error
      : new Error("Invalid tool input.");
  }
  return typeof tool.needsApproval === "function"
    ? await tool.needsApproval(validated.value, {
        context: undefined,
        messages: [...messages],
        toolCallId: callId,
      })
    : Boolean(tool.needsApproval);
};

export const executeEveMcpTool = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal" | "approval">,
  messages: readonly ModelMessage[]
) => {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!ownerId) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  context.abortSignal.throwIfAborted();
  const connector = assertConnector(
    await withAbort(
      () => getMcpConnectorById({ id: connectorId }),
      context.abortSignal
    ),
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
    for await (const output of executeMcpTool(
      validatedTool,
      input,
      context,
      messages
    )) {
      result = output;
    }
    const converted = tool.toModelOutput
      ? await tool.toModelOutput({
          input,
          output: result,
          toolCallId: context.callId,
        })
      : { type: "json", value: result };
    return eveMcpResult.parse({
      kind: "chatjs.mcp-result",
      modelOutput: converted,
      output: result,
    });
  });
};

/** Native request evaluation; only serializable identifiers enter durable callbacks. */
export const requestEveMcpApproval = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal">,
  messages: readonly ModelMessage[]
): Promise<"user-approval" | "not-applicable"> => {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!ownerId) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  const signal = AbortSignal.any([
    context.abortSignal,
    AbortSignal.timeout(30_000),
  ]);
  const connector = assertConnector(
    await withAbort(() => getMcpConnectorById({ id: connectorId }), signal),
    ownerId
  );
  return await withConnector(connector, signal, async (tools) => {
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
  });
};
