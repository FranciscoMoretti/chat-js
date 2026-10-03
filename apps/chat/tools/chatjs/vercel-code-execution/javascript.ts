import type { CodeExecutionContext, CodeExecutionResult } from "./types";

const EXECUTION_STATUS_PREFIX = "__EXECUTION_STATUS__:";

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
const createWrappedCode = (code: string): string => {
  // Inject user code as a string literal so backticks / ${} in user code
  // cannot break out of the wrapper template.
  const userCodeLiteral = JSON.stringify(code);
  return `
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
    const __userCode = ${userCodeLiteral};
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
};
/* oxlint-enable eslint/max-lines-per-function */

interface JsExecInfo {
  success: boolean;
  error?: { name: string; value: string; traceback: string };
}

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const execInfoFromExitCode = (exitCode: number): JsExecInfo => {
  if (exitCode === 0) {
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
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const parseExecutionOutput = async (execResult: {
  stdout: () => Promise<string>;
  exitCode: number;
}): Promise<{
  outputText: string;
  execInfo: JsExecInfo;
}> => {
  const stdout = await execResult.stdout();
  const lines = (stdout ?? "").split("\n");
  // Search from the end so a user console.log of the prefix cannot be
  // mistaken for the real status trailer emitted last by the wrapper.
  const statusLineIndex = lines.findLastIndex((line) =>
    line.startsWith(EXECUTION_STATUS_PREFIX)
  );

  if (statusLineIndex === -1) {
    return {
      execInfo: execInfoFromExitCode(execResult.exitCode),
      outputText: stdout ?? "",
    };
  }

  const execInfoRaw = lines[statusLineIndex].slice(
    EXECUTION_STATUS_PREFIX.length
  );
  let execInfo: JsExecInfo;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The sandbox protocol emits this JSON envelope; validating a new schema would change compatibility with saved executions.
    execInfo = JSON.parse(execInfoRaw) as JsExecInfo;
  } catch {
    return {
      execInfo: execInfoFromExitCode(execResult.exitCode),
      outputText: stdout ?? "",
    };
  }
  lines.splice(statusLineIndex, 1);

  return {
    execInfo,
    outputText: lines.join("\n").trim(),
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const executeJavaScriptInSandbox = async ({
  sandbox,
  code,
  log,
  requestId,
}: CodeExecutionContext): Promise<CodeExecutionResult> => {
  const execResult = await sandbox.runCommand({
    args: ["--input-type=module", "-e", createWrappedCode(code)],
    cmd: "node",
  });

  const { outputText, execInfo } = await parseExecutionOutput(execResult);
  const stderr = await execResult.stderr();
  const stderrTrimmed = stderr?.trim();
  let message = "";

  if (outputText) {
    message += `${outputText}\n`;
  }
  if (stderrTrimmed) {
    message += `${stderrTrimmed}\n`;
  }
  if (execInfo.error) {
    message += `Error: ${execInfo.error.name}: ${execInfo.error.value}\n`;
    log.error(
      { error: execInfo.error, requestId },
      "javascript execution error"
    );
  }

  return {
    chart: "",
    message: message.trim(),
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
