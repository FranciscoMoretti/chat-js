import type { CodeExecutionContext, CodeExecutionResult } from "./types";

const SUCCESS_EXIT_CODE = 0;
const MISSING_STATUS_LINE_INDEX = -1;
const STATUS_TRAILER_LINE_COUNT = 1;
const EXECUTION_STATUS_PREFIX = "__EXECUTION_STATUS__:";

const JAVASCRIPT_EXECUTION_TEMPLATE = `
import { inspect } from "node:util";

const __formatOutput = (value) => {
  if (typeof value === "string") {
    return value;
  }

  return inspect(value, {
    depth: 4,
    colors: false,
    maxArrayLength: 100,
    breakLength: 120,
  });
};

const __run = async () => {
  try {
    const __userCode = __USER_CODE_LITERAL__;
    const __execution = await (0, eval)(
      "(async () => {\\n" +
      __userCode + "\\n" +
      "return { __kind: \\"locals\\"," +
      " result: typeof result !== \\"undefined\\" ? result : undefined," +
      " results: typeof results !== \\"undefined\\" ? results : undefined };\\n" +
      "})()"
    );

    const __result =
      __execution &&
      typeof __execution === "object" &&
      __execution.__kind === "locals"
        ? typeof __execution.result !== "undefined"
          ? __execution.result
          : typeof __execution.results !== "undefined"
            ? __execution.results
            : undefined
        : __execution;

    if (typeof __result !== "undefined") {
      console.log(__formatOutput(__result));
    }

    console.log("${EXECUTION_STATUS_PREFIX}" + JSON.stringify({ success: true }));
  } catch (error) {
    const execError = error instanceof Error ? error : new Error(String(error));
    console.log(
      "${EXECUTION_STATUS_PREFIX}" +
        JSON.stringify({
          success: false,
          error: {
            name: execError.name,
            value: execError.message,
            traceback: execError.stack ?? execError.message,
          },
        })
    );
    process.exitCode = 1;
  }
};

await __run();
`;

const createWrappedCode = (code: string): string =>
  JAVASCRIPT_EXECUTION_TEMPLATE.replace("__USER_CODE_LITERAL__", (): string =>
    JSON.stringify(code)
  );

interface JsExecInfo {
  success?: unknown;
  error?: unknown;
}

const execInfoFromExitCode = (exitCode: number): JsExecInfo => {
  if (exitCode === SUCCESS_EXIT_CODE) {
    return { success: true };
  }
  return {
    error: {
      name: "SandboxExecutionError",
      traceback: "",
      value: "Execution completed without a valid status trailer",
    },
    success: false,
  };
};

const readExecutionErrorField = (error: unknown, key: string): unknown =>
  Reflect.get(new Object(error), key);

const readExecutionError = (info: unknown): unknown => {
  if (info === null) {
    throw new TypeError("Sandbox execution status cannot be null.");
  }
  return readExecutionErrorField(info, "error");
};

const decodeExecutionTrailer = (
  raw: string
): { valid: true; info: unknown } | { valid: false } => {
  try {
    const parsed: unknown = JSON.parse(raw);
    return { info: parsed, valid: true };
  } catch {
    return { valid: false };
  }
};

const findExecutionTrailer = (
  lines: readonly string[]
): { found: true; index: number; raw: string } | { found: false } => {
  // The final trailer wins over user output that happens to share the prefix.
  const index = lines.findLastIndex((line) =>
    line.startsWith(EXECUTION_STATUS_PREFIX)
  );
  if (index === MISSING_STATUS_LINE_INDEX) {
    return { found: false };
  }
  return {
    found: true,
    index,
    raw: lines[index].slice(EXECUTION_STATUS_PREFIX.length),
  };
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve parseExecutionOutput's awaited sequencing and rejected-Promise behavior. */
const parseExecutionOutput = async (
  execResult: Readonly<{
    stdout: () => Promise<string>;
    exitCode: number;
  }>
): Promise<{
  outputText: string;
  execInfo: unknown;
}> => {
  const stdout = await execResult.stdout();
  const lines = (stdout ?? "").split("\n");
  const trailer = findExecutionTrailer(lines);

  if (!trailer.found) {
    return {
      execInfo: execInfoFromExitCode(execResult.exitCode),
      outputText: stdout ?? "",
    };
  }

  const decoded = decodeExecutionTrailer(trailer.raw);
  if (!decoded.valid) {
    return {
      execInfo: execInfoFromExitCode(execResult.exitCode),
      outputText: stdout ?? "",
    };
  }
  lines.splice(trailer.index, STATUS_TRAILER_LINE_COUNT);

  return {
    execInfo: decoded.info,
    outputText: lines.join("\n").trim(),
  };
};
/* oxlint-enable oxc/no-async-await */
const formatExecutionMessage = (
  parts: Readonly<{
    outputText: string;
    stderr: string;
    execInfo: unknown;
  }>,
  context: Readonly<{
    log: Readonly<Pick<CodeExecutionContext["log"], "error">>;
    requestId: string;
  }>
): string => {
  const lines = [parts.outputText, parts.stderr.trim()];
  const executionError = readExecutionError(parts.execInfo);
  const hasExecutionError = Boolean(executionError);
  if (hasExecutionError) {
    lines.push(
      `Error: ${String(readExecutionErrorField(executionError, "name"))}: ${String(readExecutionErrorField(executionError, "value"))}`
    );
    context.log.error(
      { error: executionError, requestId: context.requestId },
      "javascript execution error"
    );
  }
  return lines
    .filter((line) => line !== "")
    .join("\n")
    .trim();
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeJavaScriptInSandbox); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeJavaScriptInSandbox's awaited sequencing and rejected-Promise behavior. */
export const executeJavaScriptInSandbox = async ({
  sandbox,
  code,
  log,
  requestId,
}: Readonly<
  Pick<CodeExecutionContext, "code" | "requestId"> & {
    sandbox: Readonly<Pick<CodeExecutionContext["sandbox"], "runCommand">>;
    log: Readonly<Pick<CodeExecutionContext["log"], "error">>;
  }
>): Promise<CodeExecutionResult> => {
  const execResult = await sandbox.runCommand({
    args: ["--input-type=module", "-e", createWrappedCode(code)],
    cmd: "node",
  });

  const { outputText, execInfo } = await parseExecutionOutput(execResult);
  const stderr = await execResult.stderr();
  return {
    chart: "",
    message: formatExecutionMessage(
      { execInfo, outputText, stderr },
      { log, requestId }
    ),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
