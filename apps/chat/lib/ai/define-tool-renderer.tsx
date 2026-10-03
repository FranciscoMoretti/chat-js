"use client";

/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import React from "react";
import type { ComponentType } from "react";
import { z } from "zod";
/* oxlint-enable sort-imports */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): ValidatedToolRenderer is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ValidatedToolRenderer stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ValidatedToolRenderer API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ValidatedToolRenderer = ComponentType<{
  isReadonly: boolean;
  messageId: string;
  tool: unknown;
}> & { validatedToolRenderer: true };
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export --
 * import/exports-last (#522): isValidatedToolRenderer is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): isValidatedToolRenderer stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named isValidatedToolRenderer API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const isValidatedToolRenderer = (
  renderer: unknown
): renderer is ValidatedToolRenderer =>
  typeof renderer === "function" &&
  "validatedToolRenderer" in renderer &&
  renderer.validatedToolRenderer === true;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

type RenderableTool<TInput, TOutput> = { toolCallId: string } & (
  | { state: "input-streaming"; input?: Partial<TInput>; output?: never }
  | { state: "input-available"; input: TInput; output?: never }
  | { state: "output-available"; input: TInput; output: TOutput }
);

/* oxlint-disable id-length, import/exports-last, import/group-exports, import/no-named-export, typescript/consistent-type-definitions --
 * id-length (#506): ToolRendererProps uses I; O as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/exports-last (#522): ToolRendererProps is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ToolRendererProps stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ToolRendererProps API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): ToolRendererProps preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type ToolRendererProps<I extends z.ZodType, O extends z.ZodType> = {
  tool: RenderableTool<z.output<I>, z.output<O>>;
  messageId: string;
  isReadonly: boolean;
};
/* oxlint-enable id-length, import/exports-last, import/group-exports, import/no-named-export, typescript/consistent-type-definitions */

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

/* oxlint-disable react/jsx-no-literals, react/only-export-components --
 * react/jsx-no-literals (#549): InvalidResult owns this page copy; replacing literal text requires a localization/content-management contract.
 * react/only-export-components (#553): InvalidResult is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
const InvalidResult = (): React.JSX.Element => (
  <p role="alert">This tool result could not be displayed.</p>
);
/* oxlint-enable react/jsx-no-literals, react/only-export-components */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): defineToolRenderer stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named defineToolRenderer API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): defineToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): defineToolRenderer's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): defineToolRenderer keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): defineToolRenderer keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-ternary (#518): defineToolRenderer derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): defineToolRenderer uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-optional-chaining (#542): defineToolRenderer handles optional streamingInputSchema?.safeParse(value.input); input?.success; updateSchema?.safeParse(update); value?.success without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): defineToolRenderer copies or separates ...identity while preserving existing object ownership; mutating source objects is not equivalent.
 * react-perf/jsx-no-new-object-as-prop (#558): defineToolRenderer creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-no-literals (#549): defineToolRenderer owns this page copy; replacing literal text requires a localization/content-management contract.
 * react/jsx-props-no-spreading (#550): defineToolRenderer forwards its typed component props; enumerating them would narrow the wrapper's supported interface.
 * react/no-multi-comp (#552): defineToolRenderer keeps related render components together; extraction changes component, state, and layout boundaries.
 * typescript/explicit-function-return-type (#560): Keep defineToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep defineToolRenderer's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): defineToolRenderer accepts { inputSchema, streamingInputSchema, outputSchema, updateSchema, renderProgress: Prog; { tool, messageId, isReadonly, }: { tool: unknown; messageId: string; isRe; props: { tool: unknown; messageId: string; isReadonly: boolean; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): defineToolRenderer intentionally keeps the existing falsy-value behavior of input?.success; value?.success; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Keep executable tools on the server and validate their persisted data at the UI boundary. */
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
      const input = streamingInputSchema?.safeParse(value.input);
      return (
        <Renderer
          {...common}
          tool={{
            ...identity,
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
          tool={{ ...identity, input: input.data, state: value.state }}
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
          ...identity,
          input: input.data,
          output: output.data,
          state: value.state,
        }}
      />
    );
  };
  const ValidatedToolRenderer = (props: {
    tool: unknown;
    messageId: string;
    isReadonly: boolean;
  }): React.JSX.Element => {
    const parsed = envelope.safeParse(props.tool);
    const updates = (parsed.success ? (parsed.data.updates ?? []) : []).flatMap(
      (update) => {
        const value = updateSchema?.safeParse(update);
        return value?.success ? [value.data] : [];
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
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
