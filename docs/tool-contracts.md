# Shared tool contracts

Tool schemas are the source of truth for execution results and renderer props. Eve messages remain native: their payloads are unknown until a tool-specific renderer validates them. There is no global typed-message assertion, projection, or cache.

## Ownership

Keep browser-safe schemas in each tool's `schemas.ts`. An existing `definition.ts` may group those schemas with tool metadata. Execution code imports the same schemas as `renderer.tsx`; frontend modules must not import execution code at runtime. Registry-owned tools live under `packages/registry/src/tools`; `bun demo:sync` generates their reference-app copies.

## Backend

Pass the shared input schema to Eve's `defineTool`. Validate the successful domain result before wrapping it in a ChatJS receipt:

```ts
return await executeWithToolUsage(context, (usage) => {
  usage.addCostUsd(0);
  return validateToolOutput(toolDefinition.outputSchema, {
    characters,
    charactersNoSpaces,
    sentences,
    words,
  });
});
```

`validateToolOutput` uses `NoInfer` so an incorrect authored result cannot widen the schema's input type. It also enforces runtime refinements and returns the schema's parsed output type. For genuinely unknown provider responses, use the shared schema's `.parse(response)` directly. Input and output types may differ when a schema normalizes data.

Receipt metadata (usage, errors and progress) belongs to the Eve adapter, not the domain output schema. Validate successful preliminary outputs against their applicable shared contract too. Existing explicit error receipts remain errors rather than fabricated success payloads.

## Frontend

`EveToolResult` unwraps the receipt. `defineToolRenderer` validates the envelope once, then validates the input/output appropriate to the lifecycle state before invoking the typed view:

```tsx
export const WordCountRenderer = defineToolRenderer({
  inputSchema: toolDefinition.inputSchema,
  outputSchema: toolDefinition.outputSchema,
  render: ({ tool }) => {
    if (tool.state !== "output-available") return null;
    return <span>{tool.output.words} words</span>;
  },
});
```

For a separate view component, derive its props with `ToolRendererProps<typeof inputSchema, typeof outputSchema>` from `chatjs/core/tools/define-renderer`. Callbacks cannot widen the schema types. Registry keys are checked against execution names, while registry values must be validating wrappers accepting unknown transport data; view payload types are inferred only from schemas.

Streaming input is absent unless the tool supplies a partial-input validator. Preliminary outputs retain `partial: true`; output availability is not final completion. Errors, denials and approvals keep their lifecycle presentation. Malformed persisted inputs/results produce the standard invalid-result fallback without reaching the typed view. Unknown tools and imported text outputs use native generic presentation.

No memoization or validation cache is introduced in this version.
