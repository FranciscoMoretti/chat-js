import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { ToolContext, ToolDefinition } from "eve/tools";
import { z } from "zod";

import type { ToolOutput } from "@/lib/eve/tool-result";
import { eveToolAllowed } from "@/lib/eve/turn-tools";
import { supportsSavedDocuments } from "@/tools/chatjs/code-execution-config";
import { providers } from "@/tools/chatjs/providers";

type InvocableTool = Pick<
  ToolDefinition<unknown, ToolOutput>,
  "execute" | "inputSchema"
>;

// Composition is gated by saved-document execution.
// The standalone tool visibility flag does not disable that feature's dependency.
const getInstalledExecutor = (): InvocableTool | undefined => {
  if (!supportsSavedDocuments) {
    throw new Error("The installed executor does not support saved documents.");
  }
  const name = "codeExecution";
  const installed: Readonly<
    Record<
      string,
      InvocableTool & {
        approval?: unknown;
        availableInSubagents?: boolean;
        outputSchema?: unknown;
      }
    >
  > = providers;
  const definition = installed[name];
  if (!definition || !eveToolAllowed(name)) {
    return;
  }
  // Internal execution cannot present EVE's approval UI. Never bypass an authored policy.
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

const installedToolSchema = (tool: InvocableTool) => {
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
export const invokeSavedCodeExecutor = async function* invokeSavedCodeExecutor(
  input: { code: string; language: "python" | "javascript"; title: string },
  context: ToolContext
) {
  const tool = getInstalledExecutor();
  if (!tool) {
    throw new Error("Installed code executor is unavailable.");
  }
  const schema = installedToolSchema(tool);
  let validatedInput: unknown = input;
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
  const source = z
    .object({
      code: z.string(),
      language: z.enum(["python", "javascript"]),
      title: z.string(),
    })
    .safeParse(validatedInput);
  if (
    !source.success ||
    source.data.code !== input.code ||
    source.data.language !== input.language ||
    source.data.title !== input.title
  ) {
    throw new Error(
      "The installed executor must preserve the exact saved source and language."
    );
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
