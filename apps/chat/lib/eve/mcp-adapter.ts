import type { ModelMessage, Tool } from "ai";
import type { ToolContext } from "eve/tools";
import { asSchema } from "ai";
import { z } from "zod";

const isAsyncIterable = <Output>(
  value: unknown
): value is AsyncIterable<Output> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";

/** Describe discovered MCP tools; approval and output policies are handled by the MCP integration.
 * @param {Readonly<Pick<Tool<TInput, TOutput>, "description" | "inputSchema" | "type"> & { toModelOutput?: unknown }>} definition - Native input schema and description metadata; output policies are detected and rejected without invoking or inspecting their signatures.
 * @returns {Promise<{ description: string; inputSchema: Record<string, z.infer<ReturnType<typeof z.json>>>; }>} A serializable description and validated JSON input schema.
 */
const describeMcpTool = async <TInput, TOutput>(
  definition: Readonly<
    Pick<Tool<TInput, TOutput>, "description" | "inputSchema" | "type"> & {
      toModelOutput?: unknown;
    }
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
/**
 * Resolve module-level definitions at execution time, avoiding executable captures in durable closures.
 * @param {Readonly<Pick<Tool<TInput, TOutput>, "inputSchema" | "execute">>} definition - Native schema and executor resolved at call time.
 * @param {unknown} input - Untrusted input validated by the SDK schema.
 * @param {Readonly<{ callId: ToolContext["callId"]; abortSignal: Readonly<AbortSignal>; }>} context - Call identity and cancellation.
 * @param {readonly ModelMessage[]} messages - Prior model messages.
 * @yields {unknown} Each output emitted by the installed AI SDK tool.
 */
const executeMcpTool = async function* executeMcpTool<TInput, TOutput>(
  definition: Readonly<Pick<Tool<TInput, TOutput>, "inputSchema" | "execute">>,
  input: unknown,
  context: Readonly<{
    callId: ToolContext["callId"];
    abortSignal: Readonly<AbortSignal>;
  }>,
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
