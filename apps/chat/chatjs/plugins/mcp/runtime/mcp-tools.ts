import type { ModelMessage, Tool } from "ai";
import { createHash } from "node:crypto";
import { asSchema, jsonSchema } from "ai";
import { describeMcpTool, executeMcpTool } from "./mcp-adapter";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { McpConnector } from "@/chatjs/plugins/mcp/db/mcp-schema";
import type { ToolContext } from "eve/tools";
import { requireMcpCredentials } from "@/chatjs/plugins/mcp/setup";
import { MCPClient } from "@/chatjs/plugins/mcp/oauth/mcp-client";
import { createModuleLogger } from "@/lib/logger";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { installedPlugins } from "@/integrations/plugin-catalog";
import {
  getMcpConnectorById,
  getMcpConnectorsByUserId,
} from "@/chatjs/plugins/mcp/db/mcp-queries";
import { eveMcpResult } from "@/lib/eve/mcp-result";

// Read-only native session/approval metadata and cancellation used by MCP adapters.
type McpToolContext = Readonly<{
  session: ToolContext["session"];
  callId: ToolContext["callId"];
  abortSignal: Readonly<AbortSignal>;
  approval?: Readonly<Pick<NonNullable<ToolContext["approval"]>, "responder">>;
}>;

const log = createModuleLogger("eve.mcp");

const FIRST_CHARACTER_INDEX = 0;
const TOOL_NAME_PREFIX_LENGTH = 51;
const TOOL_NAME_HASH_LENGTH = 12;
const CONNECTOR_DISCOVERY_TIMEOUT_MS = 10_000;
const CONNECTOR_DISCOVERY_CONCURRENCY = 2;
const MCP_APPROVAL_TIMEOUT_MS = 30_000;
const MAXIMUM_VALIDATION_ERRORS = 3;
type ValidatedMcpTool<NativeTool> = NativeTool extends Tool
  ? Omit<NativeTool, "inputSchema"> & {
      inputSchema: ReturnType<typeof jsonSchema<Record<string, unknown>>>;
    }
  : never;

const VALID_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/u;
const UNSAFE_TOOL_NAME = /[^a-zA-Z0-9_-]/gu;

const modelToolName = (name: string): string => {
  if (VALID_TOOL_NAME.test(name)) {
    return name;
  }
  return `${name.replace(UNSAFE_TOOL_NAME, "_").slice(FIRST_CHARACTER_INDEX, TOOL_NAME_PREFIX_LENGTH)}_${createHash("sha256").update(name).digest("hex").slice(FIRST_CHARACTER_INDEX, TOOL_NAME_HASH_LENGTH)}`;
};

const withAbort = async <T>(
  operation: () => Promise<T>,
  signal: Readonly<
    Pick<
      AbortSignal,
      | "throwIfAborted"
      | "reason"
      | "addEventListener"
      | "removeEventListener"
      | "aborted"
    >
  >
): Promise<T> => {
  signal.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  const cancel = (): void => {
    aborted.reject(signal.reason);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    return await Promise.race([operation(), aborted.promise]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
};

const assertConnector = (
  connector: Readonly<
    Pick<
      McpConnector,
      | "enabled"
      | "userId"
      | "id"
      | "name"
      | "oauthClientId"
      | "oauthClientSecret"
      | "type"
      | "url"
      | "requireApproval"
    >
  > | null,
  ownerId: string
): Readonly<
  Pick<
    McpConnector,
    | "enabled"
    | "userId"
    | "id"
    | "name"
    | "oauthClientId"
    | "oauthClientSecret"
    | "type"
    | "url"
    | "requireApproval"
  >
> => {
  if (
    !(
      installedPlugins.has("mcp") &&
      connector?.enabled === true &&
      (connector.userId === ownerId || connector.userId === null)
    )
  ) {
    throw new Error("MCP connector is unavailable.");
  }
  requireMcpCredentials();
  return connector;
};

const withConnector = async <T>(
  connector: Readonly<
    Pick<
      McpConnector,
      "id" | "name" | "oauthClientId" | "oauthClientSecret" | "type" | "url"
    >
  >,
  signal: Readonly<
    Pick<
      AbortSignal,
      | "throwIfAborted"
      | "reason"
      | "addEventListener"
      | "removeEventListener"
      | "aborted"
    >
  >,
  run: (tools: Record<string, Tool>) => Promise<T>
): Promise<T> => {
  signal.throwIfAborted();
  const client = new MCPClient(connector.id, connector.name, {
    oauthClientId: connector.oauthClientId,
    oauthClientSecret: connector.oauthClientSecret,
    type: connector.type,
    url: connector.url,
  });
  let closing: Promise<void> | undefined;
  const close = async (): Promise<void> => {
    closing ??= client.close();
    await closing;
  };
  const closeAfterAbort = async (): Promise<void> => {
    try {
      await close();
    } catch {
      // The scope's finally awaits the same close and reports its failure.
    }
  };
  const cancel = (): void => {
    void closeAfterAbort();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await withAbort(async () => {
      await client.connect({ abortSignal: signal });
    }, signal);
    signal.throwIfAborted();
    if (client.status !== "connected") {
      throw new Error(
        "Connect this MCP server in settings before using its tools."
      );
    }
    const tools = await withAbort(async () => await client.tools(), signal);
    signal.throwIfAborted();
    return await withAbort(async () => await run(tools), signal);
  } finally {
    signal.removeEventListener("abort", cancel);
    await close();
  }
};
/**
 * Discovers serializable MCP descriptions while closing every opened connector client.
 * @param {string | undefined} ownerId Authenticated owner whose enabled connectors may be discovered; absence yields no tools.
 * @param {AbortSignal} signal Discovery cancellation boundary combined with each connector's connection timeout.
 * @returns {Promise< (Awaited<ReturnType<typeof describeMcpTool>> & { name: string; connectorId: string; remoteName: string; })[] >} Safe model tool names and serializable remote descriptions/identities for durable use.
 */
const discoverEveMcpTools = async (
  ownerId: string | undefined,
  signal: Readonly<AbortSignal>
): Promise<
  (Awaited<ReturnType<typeof describeMcpTool>> & {
    name: string;
    connectorId: string;
    remoteName: string;
  })[]
> => {
  if (
    !(
      typeof ownerId === "string" &&
      ownerId !== "" &&
      installedPlugins.has("mcp")
    )
  ) {
    return [];
  }
  requireMcpCredentials();
  const connectors = await withAbort(
    async () => await getMcpConnectorsByUserId({ userId: ownerId }),
    signal
  );
  const descriptions: (Awaited<ReturnType<typeof describeMcpTool>> & {
    name: string;
    connectorId: string;
    remoteName: string;
  })[] = [];
  const enabledConnectors = connectors.filter((connector) => connector.enabled);
  for (
    let offset = 0;
    offset < enabledConnectors.length;
    offset += CONNECTOR_DISCOVERY_CONCURRENCY
  ) {
    if (
      signal.aborted &&
      signal.reason instanceof DOMException &&
      signal.reason.name === "TimeoutError"
    ) {
      break;
    }
    signal.throwIfAborted();
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep at most two live connector scopes and await every close before admitting another batch or returning cancellation.
    const batch = await Promise.allSettled(
      enabledConnectors
        .slice(offset, offset + CONNECTOR_DISCOVERY_CONCURRENCY)
        .map(async (connector) => {
          const connectorDescriptions: typeof descriptions = [];
          const connectorSignal = AbortSignal.any([
            signal,
            AbortSignal.timeout(CONNECTOR_DISCOVERY_TIMEOUT_MS),
          ]);
          try {
            await withConnector(
              assertConnector(connector, ownerId),
              connectorSignal,
              async (tools): Promise<void> => {
                for (const [remoteName, tool] of Object.entries(tools)) {
                  connectorSignal.throwIfAborted();
                  try {
                    // MCP output and approval policies are adapted explicitly below.
                    const { toModelOutput: _outputAdapter, ...definition } =
                      tool;
                    // oxlint-disable-next-line no-await-in-loop -- Resolve one tool schema at a time and check cancellation before starting the next conversion within this connector's discovery window.
                    const description = await describeMcpTool(definition);
                    connectorSignal.throwIfAborted();
                    connectorDescriptions.push({
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
                    connectorSignal.throwIfAborted();
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
              return connectorDescriptions;
            }
            signal.throwIfAborted();
            log.warn(
              { connectorId: connector.id },
              "MCP discovery unavailable"
            );
          }
          return connectorDescriptions;
        })
    );
    for (const result of batch) {
      if (result.status === "rejected") {
        throw result.reason;
      }
      descriptions.push(...result.value);
    }
  }
  return descriptions;
};

const validateMcpTool = async (tool: Tool): Promise<ValidatedMcpTool<Tool>> => {
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
      validate: (value) => {
        if (validate(value)) {
          return { success: true, value };
        }
        return {
          error: new Error(
            `Invalid tool input: ${
              validate.errors
                ?.slice(FIRST_CHARACTER_INDEX, MAXIMUM_VALIDATION_ERRORS)
                .map(
                  (error: {
                    readonly instancePath: string;
                    readonly message?: string | undefined;
                  }): string => `${error.instancePath || "/"} ${error.message}`
                )
                .join("; ") ?? "schema validation failed"
            }`
          ),
          success: false,
        };
      },
    }),
  };
};

const validateMcpInput = async (
  tool: Readonly<Pick<Tool, "inputSchema">>,
  input: unknown
): Promise<void> => {
  const validated = await asSchema(tool.inputSchema).validate?.(input);
  if (validated?.success !== true) {
    if (validated?.success === false) {
      throw validated.error;
    }
    throw new Error("Invalid tool input.");
  }
};

const executeEveMcpTool = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: McpToolContext,
  messages: readonly ModelMessage[]
): Promise<ReturnType<typeof eveMcpResult.parse>> => {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!(typeof ownerId === "string" && ownerId !== "")) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  context.abortSignal.throwIfAborted();
  const connector = assertConnector(
    await withAbort(
      async () => await getMcpConnectorById({ id: connectorId }),
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
    // EVE binds this receipt to the exact session, tool, call and input.
    // Use the current persisted connector policy, not discovered SDK metadata.
    if (
      connector.requireApproval &&
      context.approval?.responder.principalId !== ownerId
    ) {
      throw new Error("MCP tools require an owner approval receipt.");
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
/**
 * Evaluates current MCP approval policy using serializable identifiers and a temporary client.
 * @param {string} connectorId Connector identity resolved against the authenticated owner and installed MCP plugin.
 * @param {string} remoteName Exact remote tool name whose availability and schema are rechecked.
 * @param {unknown} input Tool input validated before its current approval policy is evaluated.
 * @param {Pick<McpToolContext, "session" | "abortSignal">} context Native session authentication and cancellation evidence.
 * @returns {Promise<"user-approval" | "not-applicable">} Whether the current tool requires user approval; the temporary client closes on all paths.
 */
const requestEveMcpApproval = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<McpToolContext, "session" | "abortSignal">
): Promise<"user-approval" | "not-applicable"> => {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!(typeof ownerId === "string" && ownerId !== "")) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  const signal = AbortSignal.any([
    context.abortSignal,
    AbortSignal.timeout(MCP_APPROVAL_TIMEOUT_MS),
  ]);
  const connector = assertConnector(
    await withAbort(
      async () => await getMcpConnectorById({ id: connectorId }),
      signal
    ),
    ownerId
  );
  return await withConnector(connector, signal, async (tools) => {
    if (!Object.hasOwn(tools, remoteName)) {
      throw new Error("MCP tool is no longer available.");
    }
    await validateMcpInput(await validateMcpTool(tools[remoteName]), input);

    if (connector.requireApproval) {
      return "user-approval";
    }
    return "not-applicable";
  });
};

export {
  discoverEveMcpTools,
  executeEveMcpTool,
  requestEveMcpApproval,
  type McpToolContext,
};
