"use client";

import type { ComponentType } from "react";
import { z } from "zod";

export type ValidatedToolRenderer = ComponentType<{
  isReadonly: boolean;
  messageId: string;
  tool: unknown;
}> & { validatedToolRenderer: true };

export const isValidatedToolRenderer = (
  renderer: unknown
): renderer is ValidatedToolRenderer =>
  typeof renderer === "function" &&
  "validatedToolRenderer" in renderer &&
  renderer.validatedToolRenderer === true;

type RenderableTool<TInput, TOutput> = { toolCallId: string } & (
  | { state: "input-streaming"; input?: undefined }
  | { state: "input-available"; input: TInput }
  | { state: "output-available"; input: TInput; output: TOutput }
);

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
});

const InvalidResult = () => (
  <p role="alert">This tool result could not be displayed.</p>
);

/** Keep executable tools on the server and validate their persisted data at the UI boundary. */
export const defineToolRenderer = <TInput, TOutput>({
  inputSchema,
  outputSchema,
  render: Renderer,
}: {
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  render: ComponentType<{
    tool: RenderableTool<TInput, TOutput>;
    messageId: string;
    isReadonly: boolean;
  }>;
}) => {
  const ValidatedToolRenderer = ({
    tool,
    messageId,
    isReadonly,
  }: {
    tool: unknown;
    messageId: string;
    isReadonly: boolean;
  }) => {
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
      return (
        <Renderer {...common} tool={{ ...identity, state: value.state }} />
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
  return Object.assign(ValidatedToolRenderer, {
    validatedToolRenderer: true as const,
  });
};
