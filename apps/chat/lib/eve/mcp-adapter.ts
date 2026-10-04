import { asSchema } from "ai";
import type { ModelMessage, Tool } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";

/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const isAsyncIterable = <T>(
  value: T | AsyncIterable<T>
): value is AsyncIterable<T> =>
  typeof value === "object" &&
  value !== null &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */

/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/** Isolate legacy approval metadata while preserving its boolean or predicate contract. */
const splitMcpToolApproval = <TInput, TOutput>(tool: Tool<TInput, TOutput>) => {
  // oxlint-disable-next-line typescript/no-deprecated -- Preserve existing boolean and conditional MCP policies until their producers migrate off needsApproval; keep the compatibility read isolated here.
  const { needsApproval: approval, ...definition } = tool;
  return { approval, definition };
};

/** Describe discovered MCP tools; approval and output policies are handled by the MCP integration. */
const describeMcpTool = async <TInput, TOutput>(
  definition: Tool<TInput, TOutput>
) => {
  if (
    splitMcpToolApproval(definition).approval ||
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable jsdoc/require-returns */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/**
 * Resolve module-level definitions at execution time, avoiding executable captures in durable closures.
 * @yields {unknown} Each output emitted by the installed AI SDK tool.
 */
const executeMcpTool = async function* executeMcpTool<TInput, TOutput>(
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
export { describeMcpTool, executeMcpTool, splitMcpToolApproval };
