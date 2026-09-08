import { asSchema, type ModelMessage, type Tool } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

function isAsyncIterable<T>(
  value: T | AsyncIterable<T>
): value is AsyncIterable<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof value[Symbol.asyncIterator] === "function"
  );
}

/** Adapt only ordinary application tools; approval and output policies need explicit Eve definitions. */
export async function describeEveTool<TInput, TOutput>(
  definition: Tool<TInput, TOutput>
) {
  if (
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
          key === "~standard" ? undefined : value
        )
      )
    );
  return {
    description: definition.description ?? "Application tool",
    inputSchema,
  };
}

/** Resolve module-level definitions at execution time, avoiding executable captures in durable closures. */
export async function* executeEveTool<TInput, TOutput>(
  definition: Tool<TInput, TOutput>,
  input: unknown,
  context: ToolContext,
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
    toolCallId: context.callId,
    abortSignal: context.abortSignal,
    messages: [...messages],
    context: undefined,
  });
  if (isAsyncIterable(output)) {
    yield* output;
  } else {
    yield output;
  }
}
