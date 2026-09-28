import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ToolContext, ToolDefinition, ToolModelOutput } from "eve/tools";
import { z } from "zod";

import { tools } from "../../tools/chatjs/tools";
import type { ToolOutput } from "./tool-result";
import { eveInstalledToolEnabled, eveToolAllowed } from "./turn-tools";

type InvocableTool = Pick<
  ToolDefinition<unknown, ToolOutput>,
  "description" | "execute" | "inputSchema"
> & {
  // oxlint-disable-next-line typescript/method-signature-style -- Bivariance is confined to dynamic invocation; authored registries retain exact output types.
  toModelOutput?(
    output: ToolOutput
  ): ToolModelOutput | Promise<ToolModelOutput>;
};

export const getInstalledTool = (name: string): InvocableTool | undefined => {
  const installed: Readonly<
    Record<
      string,
      InvocableTool & {
        approval?: unknown;
        availableInSubagents?: boolean;
        outputSchema?: unknown;
      }
    >
  > = tools;
  const definition = installed[name];
  if (!definition || !eveInstalledToolEnabled(name) || !eveToolAllowed(name)) {
    return;
  }
  // Nested model loops cannot present EVE's approval UI. Never bypass an authored policy.
  if ("approval" in definition && definition.approval) {
    throw new Error(
      "Tools with approval policies must be called directly through EVE."
    );
  }
  if (definition.availableInSubagents === false || definition.outputSchema) {
    throw new Error(
      "Tools with execution policies or output schemas must be called directly through EVE."
    );
  }
  return definition;
};

export const installedToolSchema = (tool: InvocableTool) => {
  const schema = tool.inputSchema;
  let json: unknown = schema;
  if ("~standard" in schema) {
    const standard = schema["~standard"];
    if (
      !standard ||
      typeof standard !== "object" ||
      !("jsonSchema" in standard)
    ) {
      throw new Error("Nested tools require an exportable JSON schema.");
    }
    const converter = standard.jsonSchema;
    if (
      !converter ||
      typeof converter !== "object" ||
      !("input" in converter) ||
      typeof converter.input !== "function"
    ) {
      throw new Error("Nested tools require an exportable JSON schema.");
    }
    json = converter.input({ target: "draft-2020-12" });
  }
  return z
    .record(z.string(), z.json())
    .parse(
      JSON.parse(
        JSON.stringify(json, (key, value) =>
          key === "~standard" ? undefined : value
        )
      )
    );
};

const requireDirectInvocation = (): never => {
  throw new Error("Tool authorization requires a direct EVE invocation.");
};

/** Internal composition under the parent call, not a separate EVE dispatch.
 * @yields {unknown} The native tool outputs without altering its receipt.
 */
export const invokeInstalledTool = async function* invokeInstalledTool(
  name: "webSearch" | "codeExecution",
  input: unknown,
  context: ToolContext
) {
  const tool = getInstalledTool(name);
  if (!tool) {
    throw new Error(`Installed tool is unavailable: ${name}`);
  }
  const schema = installedToolSchema(tool);
  let validatedInput = input;
  const standard = tool.inputSchema["~standard"];
  if (
    standard &&
    typeof standard === "object" &&
    "validate" in standard &&
    typeof standard.validate === "function"
  ) {
    const result = await standard.validate(input);
    if (
      !result ||
      typeof result !== "object" ||
      result.issues ||
      !("value" in result)
    ) {
      throw new Error("Invalid tool input.");
    }
    validatedInput = result.value;
  } else {
    const Validator =
      schema.$schema === "http://json-schema.org/draft-07/schema#"
        ? Ajv
        : Ajv2020;
    const validate = new Validator({
      strict: false,
      validateFormats: false,
    }).compile(schema);
    if (!validate(input)) {
      throw new Error("Invalid tool input.");
    }
  }
  context.abortSignal.throwIfAborted();
  const result = await tool.execute(validatedInput, {
    ...context,
    approval: undefined,
    getToken: requireDirectInvocation,
    requireAuth: requireDirectInvocation,
  });
  if (
    typeof result === "object" &&
    result !== null &&
    Symbol.asyncIterator in result
  ) {
    yield* result;
  } else {
    yield result;
  }
};
