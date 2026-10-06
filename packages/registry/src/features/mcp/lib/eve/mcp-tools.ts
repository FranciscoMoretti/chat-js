/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ModelMessage, Tool } from "ai";
/* oxlint-enable sort-imports */
import { asSchema, jsonSchema } from "ai";
import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ToolContext } from "eve/tools";

import { installedFeatures } from "@/features/installed";
import { requireMcpCredentials } from "@/features/mcp/setup";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createToolId } from "@/lib/ai/mcp-name-id";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MCPClient } from "@/lib/ai/mcp/mcp-client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getMcpConnectorById,
  getMcpConnectorsByUserId,
} from "@/lib/db/mcp-queries";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies.
import type { McpConnector } from "@/lib/db/schema";
import { eveMcpResult } from "@/lib/eve/mcp-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describeMcpTool, executeMcpTool } from "./mcp-adapter";
/* oxlint-enable sort-imports */

type ReadonlyNativeSurface<Value> = Value extends (
  ...parameters: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? {
        readonly [Property in keyof Value]: ReadonlyNativeSurface<
          Value[Property]
        >;
      }
    : Value;

const log = createModuleLogger("eve.mcp");

const FIRST_CHARACTER_INDEX = 0;
const TOOL_NAME_PREFIX_LENGTH = 51;
const TOOL_NAME_HASH_LENGTH = 12;
const CONNECTOR_DISCOVERY_TIMEOUT_MS = 10_000;
const MCP_APPROVAL_TIMEOUT_MS = 30_000;
const MAXIMUM_VALIDATION_ERRORS = 3;
type ValidatedMcpTool<NativeTool> = NativeTool extends Tool
  ? Omit<NativeTool, "inputSchema"> & {
      inputSchema: ReturnType<
        typeof jsonSchema<Record<string, NonNullable<unknown>>>
      >;
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withAbort's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
const withAbort = async <T>(
  operation: () => Promise<T>,
  signal: ReadonlyNativeSurface<AbortSignal>
): Promise<T> => {
  signal.throwIfAborted();
  const aborted = Promise.withResolvers<never>();
  const cancel = (): void => aborted.reject(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  try {
    return await Promise.race([operation(), aborted.promise]);
  } finally {
    signal.removeEventListener("abort", cancel);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/id-length */

/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const assertConnector = (
  connector: McpConnector | undefined,
  ownerId: string
): McpConnector => {
  if (
    !(
      installedFeatures.has("mcp") &&
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading enabled from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      connector?.enabled &&
      (connector.userId === ownerId || connector.userId === null)
    )
  ) {
    throw new Error("MCP connector is unavailable.");
  }
  requireMcpCredentials();
  return connector;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve withConnector's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const withConnector = async <T>(
  connector: McpConnector,
  signal: AbortSignal,
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
  const close = (): Promise<void> => {
    closing ??= client.close();
    return closing;
  };
  const cancel = (): void => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve discoverEveMcpTools's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/id-length */

/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */

/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/**
 * Discovers serializable MCP descriptions while closing every opened connector client.
 * @param {string | undefined} ownerId Authenticated owner whose enabled connectors may be discovered; absence yields no tools.
 * @param {AbortSignal} signal Discovery cancellation boundary combined with each connector's connection timeout.
 * @returns {Promise< (Awaited<ReturnType<typeof describeMcpTool>> & { name: string; connectorId: string; remoteName: string; })[] >} Safe model tool names and serializable remote descriptions/identities for durable use.
 */
const discoverEveMcpTools = async (
  ownerId: string | undefined,
  signal: AbortSignal
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
      installedFeatures.has("mcp")
    )
  ) {
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
      AbortSignal.timeout(CONNECTOR_DISCOVERY_TIMEOUT_MS),
    ]);
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Finish the scoped connector operation before releasing its client.
      await withConnector(
        assertConnector(connector, ownerId),
        connectorSignal,
        async (tools): Promise<void> => {
          for (const [remoteName, tool] of Object.entries(tools)) {
            connectorSignal.throwIfAborted();
            try {
              // MCP output and approval policies are adapted explicitly below.
              // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding definition excludes toModelOutput from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
              const { toModelOutput: _outputAdapter, ...definition } = tool;
              // oxlint-disable-next-line no-await-in-loop -- Each connector has a bounded discovery window.
              const description = await describeMcpTool(definition);
              connectorSignal.throwIfAborted();
              descriptions.push({
                // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing description own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        break;
      }
      signal.throwIfAborted();
      log.warn({ connectorId: connector.id }, "MCP discovery unavailable");
    }
  }
  return descriptions;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateMcpTool's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable eslint/no-continue */

/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing tool own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...tool,
    inputSchema: jsonSchema(schema, {
      validate: (value) => {
        if (validate(value)) {
          return { success: true, value };
        }
        return {
          error: new Error(
            `Invalid tool input: ${
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading slice from validate.errors; preserve one receiver evaluation, skipped accesses and the existing "schema validation failed" fallback.
              validate.errors
                ?.slice(FIRST_CHARACTER_INDEX, MAXIMUM_VALIDATION_ERRORS)
                .map(
                  (error): string =>
                    `${error.instancePath || "/"} ${error.message}`
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateMcpInput's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const validateMcpInput = async (tool: Tool, input: unknown): Promise<void> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling asSchema(...).validate; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
  const validated = await asSchema(tool.inputSchema).validate?.(input);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading success from validated; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  if (!validated?.success) {
    if (validated && !validated.success) {
      throw validated.error;
    }
    throw new Error("Invalid tool input.");
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeEveMcpTool's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */

/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const executeEveMcpTool = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal" | "approval">,
  messages: readonly ModelMessage[]
): Promise<ReturnType<typeof eveMcpResult.parse>> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const ownerId = context.session.auth.initiator?.principalId;
  if (!(typeof ownerId === "string" && ownerId !== "")) {
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
    // EVE binds this receipt to the exact session, tool, call and input.
    // Use the current persisted connector policy, not discovered SDK metadata.
    if (
      connector.requireApproval &&
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading responder from context.approval; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve requestEveMcpApproval's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */

/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/**
 * Evaluates current MCP approval policy using serializable identifiers and a temporary client.
 * @param {string} connectorId Connector identity resolved against the authenticated owner and installed MCP feature.
 * @param {string} remoteName Exact remote tool name whose availability and schema are rechecked.
 * @param {unknown} input Tool input validated before its current approval policy is evaluated.
 * @param {Pick<ToolContext, "session" | "abortSignal">} context Native session authentication, call identity, and cancellation evidence.
 * @returns {Promise<"user-approval" | "not-applicable">} Whether the current tool requires user approval; the temporary client closes on all paths.
 */
const requestEveMcpApproval = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "abortSignal">
): Promise<"user-approval" | "not-applicable"> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const ownerId = context.session.auth.initiator?.principalId;
  if (!(typeof ownerId === "string" && ownerId !== "")) {
    throw new Error("MCP tools require an authenticated owner.");
  }
  const signal = AbortSignal.any([
    context.abortSignal,
    AbortSignal.timeout(MCP_APPROVAL_TIMEOUT_MS),
  ]);
  const connector = assertConnector(
    await withAbort(() => getMcpConnectorById({ id: connectorId }), signal),
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (discoverEveMcpTools, executeEveMcpTool, requestEveMcpApproval); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable eslint/max-params */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
export { discoverEveMcpTools, executeEveMcpTool, requestEveMcpApproval };
/* oxlint-enable import/no-named-export */
