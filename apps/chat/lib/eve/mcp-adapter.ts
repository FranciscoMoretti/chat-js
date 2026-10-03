import { asSchema } from "ai";
import type { ModelMessage, Tool } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

const isAsyncIterable = <T>(
  value: T | AsyncIterable<T>
): value is AsyncIterable<T> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";

/** Describe discovered MCP tools; approval and output policies are handled by the MCP integration. */
export const describeMcpTool = async <TInput, TOutput>(
  definition: Tool<TInput, TOutput>
) => {
  if (
    // oxlint-disable-next-line typescript/no-deprecated -- MCP compatibility still reads the SDK tool-level approval contract; migration to generation-level approval requires a separate behavior change.
    definition.needsApproval ||
    definition.toModelOutput ||
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
        JSON.stringify(await schema.jsonSchema, (key, value) =>
          // oxlint-disable-next-line typescript/no-unsafe-return -- The JSON replacer preserves arbitrary tool-schema values except the explicitly removed standard-schema hook.
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
 * @yields {unknown} Each output emitted by the installed AI SDK tool.
 */
export const executeMcpTool = async function* executeMcpTool<TInput, TOutput>(
  definition: Tool<TInput, TOutput>,
  input: unknown,
  context: Pick<ToolContext, "callId" | "abortSignal">,
  messages: readonly ModelMessage[]
) {
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
    context: undefined,
    messages: [...messages],
    toolCallId: context.callId,
  });
  if (isAsyncIterable(output)) {
    yield* output;
  } else {
    yield output;
  }
};
