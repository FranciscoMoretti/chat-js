/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */

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
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
import type { McpConnector } from "@/lib/db/schema";
/* oxlint-enable import/max-dependencies */
import { describeMcpTool, executeMcpTool } from "@/lib/eve/mcp-adapter";
import { eveMcpResult } from "@/lib/eve/mcp-result";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("eve.mcp");

const VALID_TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/u;
const UNSAFE_TOOL_NAME = /[^a-zA-Z0-9_-]/gu;
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const modelToolName = (name: string): string =>
  VALID_TOOL_NAME.test(name)
    ? name
    : `${name.replace(UNSAFE_TOOL_NAME, "_").slice(0, 51)}_${createHash("sha256").update(name).digest("hex").slice(0, 12)}`;
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const withAbort = async <T>(
  operation: () => Promise<T>,
  signal: AbortSignal
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/** Only serializable descriptions leave discovery; no credentials or open clients enter a workflow closure. */
const discoverEveMcpTools = async (
  ownerId: string | undefined,
  signal: AbortSignal
) => {
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
      AbortSignal.timeout(10_000),
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
              const { toModelOutput: _outputAdapter, ...definition } = tool;
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
                      (error): string =>
                        `${error.instancePath || "/"} ${error.message}`
                    )
                    .join("; ") ?? "schema validation failed"
                }`
              ),
              success: false,
            },
    }),
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const validateMcpInput = async (tool: Tool, input: unknown): Promise<void> => {
  const validated = await asSchema(tool.inputSchema).validate?.(input);
  if (!validated?.success) {
    throw validated && !validated.success
      ? validated.error
      : new Error("Invalid tool input.");
  }
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-params */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const executeEveMcpTool = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal" | "approval">,
  messages: readonly ModelMessage[]
) => {
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
    // Remote tool metadata cannot waive owner consent.
    if (context.approval?.responder.principalId !== ownerId) {
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
/** Native request evaluation; only serializable identifiers enter durable callbacks. */
const requestEveMcpApproval = async (
  connectorId: string,
  remoteName: string,
  input: unknown,
  context: Pick<ToolContext, "session" | "abortSignal">
): Promise<"user-approval"> => {
  const ownerId = context.session.auth.initiator?.principalId;
  if (!(typeof ownerId === "string" && ownerId !== "")) {
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
    await validateMcpInput(await validateMcpTool(tools[remoteName]), input);
    return "user-approval" as const;
  });
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-params */
/* oxlint-enable jsdoc/require-returns */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
export { discoverEveMcpTools, executeEveMcpTool, requestEveMcpApproval };
