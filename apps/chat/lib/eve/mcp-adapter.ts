import { asSchema } from "ai";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ModelMessage, Tool } from "ai";
/* oxlint-enable eslint/sort-imports */
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

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-params */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
