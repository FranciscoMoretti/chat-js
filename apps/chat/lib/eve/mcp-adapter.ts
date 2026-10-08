import type { ModelMessage, Tool } from "ai";
import { asSchema } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

const isAsyncIterable = <Output>(
  value: unknown
): value is AsyncIterable<Output> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve describeMcpTool's awaited sequencing and rejected-Promise behavior. */
/** Describe discovered MCP tools; approval and output policies are handled by the MCP integration.
 * @param {Readonly<Pick<Tool<TInput, TOutput>, "description" | "inputSchema" | "toModelOutput" | "type">>} definition - Native schema and policy metadata needed to describe the tool.
 * @returns {Promise<{ description: string; inputSchema: Record<string, z.infer<ReturnType<typeof z.json>>>; }>} A serializable description and validated JSON input schema.
 */
const describeMcpTool = async <TInput, TOutput>(
  definition: Readonly<
    Pick<
      Tool<TInput, TOutput>,
      "description" | "inputSchema" | "toModelOutput" | "type"
    >
  >
): Promise<{
  description: string;
  inputSchema: Record<string, z.infer<ReturnType<typeof z.json>>>;
}> => {
  if (
    typeof definition.toModelOutput === "function" ||
    definition.type === "provider" ||
    typeof definition.description === "function"
  ) {
    throw new Error("This tool requires an explicit Eve policy adapter.");
  }
  const schema = asSchema(definition.inputSchema);
  const inputSchema = z
    .record(z.string(), z.json())
    // The AI SDK attaches executable Standard Schema metadata to JSON schemas.
    .parse(
      JSON.parse(
        JSON.stringify(
          await schema.jsonSchema,
          (key: string, value: unknown): unknown => {
            if (key === "~standard") {
              // oxlint-disable-next-line eslint/no-undefined -- JSON.stringify requires an undefined replacer result to omit executable Standard Schema metadata; other values are returned unchanged.
              return undefined;
            }
            return value;
          }
        )
      )
    );
  return {
    description: definition.description ?? "Application tool",
    inputSchema,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve executeMcpTool's asynchronous iteration and rejection behavior. */
/**
 * Resolve module-level definitions at execution time, avoiding executable captures in durable closures.
 * @param {Readonly<Pick<Tool<TInput, TOutput>, "inputSchema" | "execute">>} definition - Native schema and executor resolved at call time.
 * @param {unknown} input - Untrusted input validated by the SDK schema.
 * @param {Readonly<{ callId: ToolContext["callId"]; abortSignal: Readonly<AbortSignal>; }>} context - Call identity and cancellation.
 * @param {readonly ModelMessage[]} messages - Prior model messages.
 * @yields {unknown} Each output emitted by the installed AI SDK tool.
 */
// oxlint-disable-next-line max-params -- Preserve the exported four-argument SDK adapter contract used by discovered-tool execution and the independent native-invocation contract test; grouping context/messages into a DTO changes existing callers.
const executeMcpTool = async function* executeMcpTool<TInput, TOutput>(
  definition: Readonly<Pick<Tool<TInput, TOutput>, "inputSchema" | "execute">>,
  input: unknown,
  context: Readonly<{
    callId: ToolContext["callId"];
    abortSignal: Readonly<AbortSignal>;
  }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native ModelMessage content without cloning or changing nested SDK arrays; recursive readonly input fails the actual execute receiving ModelMessage[] even after copying the outer array.
  messages: readonly ModelMessage[]
): AsyncGenerator<Awaited<TOutput>, void, unknown> {
  const schema = asSchema(definition.inputSchema);
  if (!(schema.validate && definition.execute)) {
    throw new Error("Tool validation and execution are required.");
  }
  const result = await schema.validate(input);
  if (!result.success) {
    throw new Error("Invalid tool input.");
  }
  const output = await definition.execute(result.value, {
    abortSignal: context.abortSignal,
    // oxlint-disable-next-line eslint/no-undefined -- The SDK execute options require an explicit absent runtime context because discovered legacy tools have no Eve context adapter.
    context: undefined,
    messages: [...messages],
    toolCallId: context.callId,
  });
  if (isAsyncIterable<TOutput>(output)) {
    yield* output;
  } else {
    yield output;
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (describeMcpTool, executeMcpTool); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { describeMcpTool, executeMcpTool };
/* oxlint-enable import/no-named-export */
