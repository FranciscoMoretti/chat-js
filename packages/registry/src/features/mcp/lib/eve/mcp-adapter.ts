import { asSchema } from "ai";
import type { ModelMessage, Tool } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

const isAsyncIterable = <Output>(
  value: unknown
): value is AsyncIterable<Output> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";

/** Describe discovered MCP tools; approval and output policies are handled by the MCP integration.
 * @param definition - Tool whose JSON schema is described.
 * @returns A serializable description and validated JSON input schema.
 */
const describeMcpTool = async <TInput, TOutput>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- asSchema receives the existing FlexibleSchema<Input> instance; recursive readonly changes its generic _type and fails that actual native SDK receiver.
  definition: Tool<TInput, TOutput>
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
          (key: string, value: unknown): unknown =>
            // oxlint-disable-next-line eslint/no-undefined -- JSON.stringify requires the undefined replacer result to omit the executable ~standard schema metadata while preserving all other JSON values.
            key === "~standard" ? undefined : value
        )
      )
    );
  return {
    description: definition.description ?? "Application tool",
    inputSchema,
  };
};

/**
 * Resolve module-level definitions at execution time, avoiding executable captures in durable closures.
 * @param definition - SDK tool resolved for execution.
 * @param input - Untrusted input validated by the SDK schema.
 * @param context - Call identity and cancellation.
 * @param messages - Prior model messages.
 * @yields {unknown} Each output emitted by the installed AI SDK tool.
 */
// oxlint-disable-next-line max-params -- Preserve the exported four-argument SDK adapter contract used by discovered-tool execution and the independent native-invocation contract test; grouping context/messages into a DTO changes existing callers.
const executeMcpTool = async function* executeMcpTool<TInput, TOutput>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Pass the SDK schema and execute function unchanged; recursive readonly maps the generic schema _type and is incompatible with actual asSchema receiving FlexibleSchema<TInput>.
  definition: Tool<TInput, TOutput>,
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
export { describeMcpTool, executeMcpTool };
