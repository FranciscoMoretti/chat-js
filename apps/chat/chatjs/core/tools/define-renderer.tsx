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

interface ToolRendererProps<
  InputSchema extends z.ZodType,
  OutputSchema extends z.ZodType,
> {
  tool: RenderableTool<z.output<InputSchema>, z.output<OutputSchema>>;
  messageId: string;
  isReadonly: boolean;
}

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

const InvalidResult = (): React.JSX.Element => (
  <p role="alert">This tool result could not be displayed.</p>
);

/**
 * Validate persisted tool data before passing it to the installed UI renderer.
 * @param {object} options Schemas and components for this tool's persisted states.
 * @param {z.ZodType<TInput>} options.inputSchema Validates complete tool input.
 * @param {z.ZodType<Partial<TInput>>} [options.streamingInputSchema] Validates partial input while the tool is streaming.
 * @param {z.ZodType<TOutput>} options.outputSchema Validates completed tool output.
 * @param {z.ZodType<TUpdate>} [options.updateSchema] Filters progress updates to this tool's validated update shape.
 * @param {ComponentType} [options.renderProgress] Displays the validated progress updates.
 * @param {ComponentType} options.render Displays parsed input/output with the tool state, message identity and readonly view context.
 * @returns {Function} The renderer function with a literal validation marker recognized by the installed tool registry.
 */
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
}): ((props: {
  tool: unknown;
  messageId: string;
  isReadonly: boolean;
}) => React.JSX.Element) & { validatedToolRenderer: true } => {
  const ValidatedToolBody = ({
    tool,
    messageId,
    isReadonly,
  }: {
    readonly tool: unknown;
    readonly messageId: string;
    readonly isReadonly: boolean;
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
            input: input?.success === true ? input.data : undefined,
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
    readonly tool: unknown;
    readonly messageId: string;
    readonly isReadonly: boolean;
  }): React.JSX.Element => {
    const parsed = envelope.safeParse(props.tool);
    const updates = (parsed.success ? (parsed.data.updates ?? []) : []).flatMap(
      (update) => {
        const value = updateSchema?.safeParse(update);
        if (value?.success === true) {
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

export { isValidatedToolRenderer };
export type { ValidatedToolRenderer, ToolRendererProps };
