"use client";

import type { ComponentType } from "react";
import React from "react";
import { z } from "zod";

type ValidatedToolRenderer = ComponentType<{
  isReadonly: boolean;
  messageId: string;
  tool: unknown;
}> & { validatedToolRenderer: true };

const isValidatedToolRenderer = (
  renderer: unknown
): renderer is ValidatedToolRenderer =>
  typeof renderer === "function" &&
  "validatedToolRenderer" in renderer &&
  renderer.validatedToolRenderer === true;

type RenderableTool<TInput, TOutput> = { toolCallId: string } & (
  | { state: "input-streaming"; input?: Partial<TInput>; output?: never }
  | { state: "input-available"; input: TInput; output?: never }
  | { state: "output-available"; input: TInput; output: TOutput }
);

/* oxlint-disable id-length, typescript/consistent-type-definitions -- id-length (#506): ToolRendererProps uses I; O as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
typescript/consistent-type-definitions (#559): ToolRendererProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type ToolRendererProps<I extends z.ZodType, O extends z.ZodType> = {
  tool: RenderableTool<z.output<I>, z.output<O>>;
  messageId: string;
  isReadonly: boolean;
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */

const envelope = z.object({
  errorText: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  state: z.enum([
    "input-streaming",
    "input-available",
    "approval-requested",
    "approval-responded",
    "output-available",
    "output-error",
    "output-denied",
  ]),
  toolCallId: z.string(),
  updates: z.array(z.unknown()).optional(),
});
/* oxlint-disable react/jsx-no-literals -- InvalidResult renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/only-export-components -- * react/only-export-components (#553): InvalidResult is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision. */
const InvalidResult = (): React.JSX.Element => (
  <p role="alert">This tool result could not be displayed.</p>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (defineToolRenderer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/only-export-components */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-object-as-prop, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): defineToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): defineToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
max-lines-per-function (#510): defineToolRenderer keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
max-statements (#512): defineToolRenderer keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
no-undefined (#519): defineToolRenderer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
react-perf/jsx-no-new-object-as-prop (#558): defineToolRenderer creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react/jsx-props-no-spreading (#550): defineToolRenderer forwards its typed component props; enumerating them would narrow the wrapper's supported interface.
react/no-multi-comp (#552): defineToolRenderer keeps related render components together; extraction changes component, state, and layout boundaries.
typescript/explicit-function-return-type (#560): Keep defineToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep defineToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): defineToolRenderer accepts { inputSchema, streamingInputSchema, outputSchema, updateSchema, renderProgress: Prog; { tool, messageId, isReadonly, }: { tool: unknown; messageId: string; isRe; props: { tool: unknown; messageId: string; isReadonly: boolean; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): defineToolRenderer intentionally keeps the existing falsy-value behavior of input?.success; value?.success; distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Keep executable tools on the server and validate their persisted data at the UI boundary. */
// oxlint-disable-next-line import/group-exports -- #711: Oxlint 1.82 checks export ancestors: a grouped factory clause exposes ValidatedToolBody and ValidatedToolRenderer as local components; one-var rejects combining value declarations.
export const defineToolRenderer = <TInput, TOutput, TUpdate = never>({
  inputSchema,
  streamingInputSchema,
  outputSchema,
  updateSchema,
  renderProgress: Progress,
  render: Renderer,
}: {
  inputSchema: z.ZodType<TInput>;
  streamingInputSchema?: z.ZodType<Partial<TInput>>;
  outputSchema: z.ZodType<TOutput>;
  updateSchema?: z.ZodType<TUpdate>;
  renderProgress?: ComponentType<{ updates: TUpdate[] }>;
  render: ComponentType<{
    tool: RenderableTool<TInput, TOutput>;
    messageId: string;
    isReadonly: boolean;
  }>;
}) => {
  /* oxlint-disable react/jsx-no-literals -- ValidatedToolBody renders tool validation errors and pending-result labels; these are authored interface copy. */
  const ValidatedToolBody = ({
    tool,
    messageId,
    isReadonly,
  }: {
    tool: unknown;
    messageId: string;
    isReadonly: boolean;
  }): React.JSX.Element => {
    const parsed = envelope.safeParse(tool);
    if (!parsed.success) {
      return <InvalidResult />;
    }
    const value = parsed.data;
    const common = { isReadonly, messageId };
    const identity = { toolCallId: value.toolCallId };
    if (value.state === "output-error") {
      return <p role="alert">{value.errorText ?? "The tool failed."}</p>;
    }
    if (value.state === "output-denied") {
      return <p>Request declined.</p>;
    }
    if (value.state === "approval-requested") {
      return <p>Waiting for approval.</p>;
    }
    if (value.state === "approval-responded") {
      return <p>Waiting for the tool.</p>;
    }
    if (value.state === "input-streaming") {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading safeParse from streamingInputSchema; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      const input = streamingInputSchema?.safeParse(value.input);
      return (
        <Renderer
          {...common}
          tool={{
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...identity,
            // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading success from input; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep input as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            input: input?.success ? input.data : undefined,
            state: value.state,
          }}
        />
      );
    }
    const input = inputSchema.safeParse(value.input);
    if (!input.success) {
      return <InvalidResult />;
    }
    if (value.state === "input-available") {
      return (
        <Renderer
          {...common}
          tool={
            /* oxlint-disable oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. */
            { ...identity, input: input.data, state: value.state }
            /* oxlint-enable oxc/no-rest-spread-properties */
          }
        />
      );
    }
    const output = outputSchema.safeParse(value.output);
    if (!output.success) {
      return <InvalidResult />;
    }
    return (
      <Renderer
        {...common}
        tool={{
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...identity,
          input: input.data,
          output: output.data,
          state: value.state,
        }}
      />
    );
  };
  /* oxlint-enable react/jsx-no-literals */
  const ValidatedToolRenderer = (props: {
    tool: unknown;
    messageId: string;
    isReadonly: boolean;
  }): React.JSX.Element => {
    const parsed = envelope.safeParse(props.tool);
    // oxlint-disable-next-line no-ternary -- Keep flatMap receiver as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const updates = (parsed.success ? (parsed.data.updates ?? []) : []).flatMap(
      (update) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading safeParse from updateSchema; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        const value = updateSchema?.safeParse(update);
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading success from value; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        if (value?.success) {
          return [value.data];
        }
        return [];
      }
    );
    return (
      <>
        {Progress && <Progress updates={updates} />}
        <ValidatedToolBody {...props} />
      </>
    );
  };
  return Object.assign(ValidatedToolRenderer, {
    validatedToolRenderer: true as const,
  });
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isValidatedToolRenderer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-object-as-prop, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

// oxlint-disable-next-line import/group-exports -- #711: Keep the factory inline for Oxlint 1.82 nested-component classification; this second value export cannot join it without violating one-var.
export { isValidatedToolRenderer };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ValidatedToolRenderer, ToolRendererProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ValidatedToolRenderer, ToolRendererProps };
/* oxlint-enable import/no-named-export */
