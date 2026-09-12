import type { CodeExecutionContext, CodeExecutionResult } from "./types";

const EXECUTION_STATUS_PREFIX = "__EXECUTION_STATUS__:";

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

type JsExecInfo = {
  success: boolean;
  error?: { name: string; value: string; traceback: string };
};

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
