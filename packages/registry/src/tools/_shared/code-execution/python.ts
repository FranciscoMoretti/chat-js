import type {
  CodeExecutionContext,
  CodeExecutionResult,
  ExecutionSandbox,
} from "./types";

type PythonExecutionContext = Readonly<{
  sandbox: Readonly<ExecutionSandbox>;
  requestId: string;
  log: Readonly<Pick<CodeExecutionContext["log"], "error" | "info">>;
}>;

interface PythonExecutionInfo {
  error?: { name: string; value: string; traceback: string };
  success: boolean;
}

interface PythonExecutionOutput {
  chartData: Record<string, unknown> | null;
  execInfo: PythonExecutionInfo;
  outputText: string;
}

const WHITESPACE_REGEX = /\s+/u;
const PACKAGE_SPEC_SPLIT_RE = /[=<>![\s]/u;
const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PROCESS_SUCCESS = 0;
const PACKAGE_NAME_INDEX = 0;
const EMPTY_PACKAGE_COUNT = 0;
const LAST_LINE_INDEX = -1;
const MISSING_CHART_INDEX = -1;
const CHART_LINE_COUNT = 1;
const EMPTY_STDERR_LENGTH = 0;

const CHART_JSON_PREFIX = "__CHART_JSON__:";

const packageName = (spec: string): string =>
  spec.split(PACKAGE_SPEC_SPLIT_RE)[PACKAGE_NAME_INDEX].toLowerCase();
/* oxlint-disable oxc/no-async-await -- Production also denies promise/prefer-await-to-then and typescript/promise-function-async; a promise-chain rewrite triggers both. */

const installBasePackages = async (
  basePackages: readonly string[],
  { sandbox, requestId, log }: PythonExecutionContext
): Promise<{
  success: boolean;
  result?: CodeExecutionResult;
}> => {
  const installStep = await sandbox.runCommand({
    args: ["install", ...basePackages],
    cmd: "pip",
  });
  if (installStep.exitCode !== PROCESS_SUCCESS) {
    const errorOutput = await installStep.stderr();
    const standardOutput =
      // oxlint-disable-next-line no-ternary -- Keep standardOutput as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      errorOutput.trim() === "" ? await installStep.stdout() : "";
    const installStderr = errorOutput.trim() || standardOutput.trim();
    log.error(
      { requestId, stderr: installStderr },
      "base package installation failed"
    );
    return {
      result: {
        chart: "",
        message: `Failed to install base packages: ${installStderr}`,
      },
      success: false,
    };
  }
  log.info({ requestId }, "base packages installed");
  return { success: true };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Production also denies promise/prefer-await-to-then and typescript/promise-function-async; a promise-chain rewrite triggers both. */

const pythonPackagePlan = (
  code: string,
  basePackages: readonly string[]
): { codeWithoutPipLines: string; extraPackages: string[] } => {
  const basePackageNames = new Set(
    basePackages.map((basePackageName) => basePackageName.toLowerCase())
  );
  const lines = code.split("\n");
  const pipLines = lines.filter((line) =>
    line.trim().startsWith("!pip install ")
  );
  const extraPackages = pipLines
    .flatMap((line) =>
      line
        .trim()
        .slice("!pip install ".length)
        .split(WHITESPACE_REGEX)
        .filter(Boolean)
    )
    .filter((spec) => !basePackageNames.has(packageName(spec)));

  const codeWithoutPipLines = lines
    .filter((line) => !line.trim().startsWith("!pip install "))
    .join("\n");
  return { codeWithoutPipLines, extraPackages };
};

interface PythonPackagePreparation {
  codeToRun: string;
  installResult: {
    success: boolean;
    result?: CodeExecutionResult;
  };
}

/* oxlint-disable eslint/max-statements -- These 12 statements keep dynamic installation, stderr-before-stdout fallback, failure logging, and the original-source failure result in one awaited operation; an asynchronous helper would introduce additional Promise settlement steps. */
const processExtraPackages = async (
  code: string,
  basePackages: readonly string[],
  { sandbox, requestId, log }: PythonExecutionContext
): Promise<PythonPackagePreparation> => {
  const { codeWithoutPipLines, extraPackages } = pythonPackagePlan(
    code,
    basePackages
  );

  if (extraPackages.length === EMPTY_PACKAGE_COUNT) {
    return { codeToRun: codeWithoutPipLines, installResult: { success: true } };
  }

  log.info(
    { packageCount: extraPackages.length, requestId },
    "installing extra packages"
  );
  const dynamicInstall = await sandbox.runCommand({
    args: ["install", ...extraPackages],
    cmd: "pip",
  });
  if (dynamicInstall.exitCode !== PROCESS_SUCCESS) {
    const errorOutput = await dynamicInstall.stderr();
    const standardOutput =
      // oxlint-disable-next-line no-ternary -- Keep standardOutput as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      errorOutput.trim() === "" ? await dynamicInstall.stdout() : "";
    const stderr = errorOutput.trim() || standardOutput.trim();
    log.error(
      { exitCode: dynamicInstall.exitCode, requestId },
      "dynamic package installation failed"
    );
    return {
      codeToRun: code,
      installResult: {
        result: {
          chart: "",
          message: `Failed to install packages: ${stderr}`,
        },
        success: false,
      },
    };
  }

  return {
    codeToRun: codeWithoutPipLines,
    installResult: { success: true },
  };
};
/* oxlint-enable eslint/max-statements */
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable eslint/max-lines-per-function -- Keep the generated Python preamble and its code/path interpolations in one template to preserve script syntax. */
const createWrappedCode = (codeToRun: string, chartPath: string): string => `
import sys
import json
import traceback

try:
    import matplotlib.pyplot as _plt_module
    _orig_savefig = _plt_module.savefig
    def _intercepted_savefig(*args, **kwargs):
        _orig_savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
        _user_target = args[0] if args else kwargs.get('fname')
        if _user_target not in (None, '${chartPath}'):
            return _orig_savefig(*args, **kwargs)
    _plt_module.savefig = _intercepted_savefig
except ImportError:
    pass

try:
    exec(${JSON.stringify(codeToRun)})
    try:
        _locals = locals()
        _globals = globals()
        _chart_var = _locals.get("chart") or _globals.get("chart")
        if (isinstance(_chart_var, dict)
                and isinstance(_chart_var.get("type"), str)
                and isinstance(_chart_var.get("elements"), list)):
            print("__CHART_JSON__:" + json.dumps(_chart_var))
        else:
            if "result" in _locals:
                print(_locals["result"])
            elif "result" in _globals:
                print(_globals["result"])
            elif "results" in _locals:
                print(_locals["results"])
            elif "results" in _globals:
                print(_globals["results"])
    except Exception:
        pass
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            plt.savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
            plt.close('all')
    except ImportError:
        pass
    print(json.dumps({"success": True}))
except Exception as e:
    error_info = {"success": False, "error": {"name": type(e).__name__, "value": str(e), "traceback": traceback.format_exc()}}
    print(json.dumps(error_info))
    sys.exit(1)
`;
/* oxlint-disable oxc/no-async-await -- Production also denies promise/prefer-await-to-then and typescript/promise-function-async; a promise-chain rewrite triggers both. */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- Parse the status trailer, remove optional chart output, and retain the raw-output fallback for malformed protocol text. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const parseExecutionOutput = async (
  execResult: Readonly<{
    stdout: () => Promise<string>;
    exitCode: number;
  }>
): Promise<PythonExecutionOutput> => {
  const stdout = await execResult.stdout();
  let execInfo: PythonExecutionInfo = { success: true };
  let outputText = "";
  let chartData: Record<string, unknown> | null = null;

  try {
    const outLines = (stdout ?? "").trim().split("\n");
    const lastLine = outLines.at(LAST_LINE_INDEX);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- The sandbox protocol emits this JSON envelope; validating a new schema would change compatibility with saved executions.
    execInfo = JSON.parse(lastLine ?? "{}");
    outLines.pop();

    const chartLineIdx = outLines.findIndex((line) =>
      line.startsWith(CHART_JSON_PREFIX)
    );
    if (chartLineIdx !== MISSING_CHART_INDEX) {
      const raw = outLines[chartLineIdx].slice(CHART_JSON_PREFIX.length);
      try {
        const value: unknown = JSON.parse(raw);
        if (isJsonObject(value)) {
          chartData = value;
        }
      } catch {
        // Ignore malformed chart JSON from the sandboxed snippet.
      }
      outLines.splice(chartLineIdx, CHART_LINE_COUNT);
    }

    outputText = outLines.join("\n");
  } catch {
    outputText = stdout ?? "";
    if (execResult.exitCode !== PROCESS_SUCCESS) {
      execInfo = {
        error: {
          name: "SandboxExecutionError",
          traceback: "",
          value: "Execution completed without a parsable status trailer",
        },
        success: false,
      };
    }
  }

  return { chartData, execInfo, outputText };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Production also denies promise/prefer-await-to-then and typescript/promise-function-async; a promise-chain rewrite triggers both. */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

// oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
const checkForChart = async (
  chartPath: string,
  { sandbox, requestId, log }: PythonExecutionContext
): Promise<{ base64: string; format: string } | undefined> => {
  const chartCheck = await sandbox.runCommand({
    args: ["-f", chartPath],
    cmd: "test",
  });
  if (chartCheck.exitCode === PROCESS_SUCCESS) {
    const base64Command = await sandbox.runCommand({
      args: ["-w", "0", chartPath],
      cmd: "base64",
    });
    const b64 = await base64Command.stdout();
    log.info({ requestId }, "chart generated");
    return { base64: (b64 ?? "").trim(), format: "png" };
  }
};
/* oxlint-enable oxc/no-async-await */

const buildResponseMessage = ({
  outputText,
  stderr,
  execInfo,
  log,
  requestId,
}: Readonly<{
  outputText: string;
  stderr: string;
  execInfo: Readonly<{
    success: boolean;
    error?: Readonly<{ name: string; value: string; traceback: string }>;
  }>;
  log: Readonly<Pick<CodeExecutionContext["log"], "error">>;
  requestId: string;
}>): string => {
  let message = "";

  if (outputText) {
    message += `${outputText}\n`;
  }
  if (stderr && stderr.trim().length > EMPTY_STDERR_LENGTH) {
    message += `${stderr}\n`;
  }
  if (execInfo.error) {
    message += `Error: ${execInfo.error.name}: ${execInfo.error.value}\n`;
    log.error({ error: execInfo.error, requestId }, "python execution error");
  }

  return message;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executePythonInSandbox); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Production also denies promise/prefer-await-to-then and typescript/promise-function-async; a promise-chain rewrite triggers both. */

/* oxlint-disable eslint/max-statements -- This entry point installs dependencies, runs the sandbox, then parses output and checks for a chart. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered Python execution stages together because later stages consume earlier install and output results. */
export const executePythonInSandbox = async ({
  sandbox,
  code,
  log,
  requestId,
}: Readonly<
  Pick<CodeExecutionContext, "code" | "requestId"> & {
    sandbox: Readonly<Pick<CodeExecutionContext["sandbox"], "runCommand">>;
    log: Readonly<Pick<CodeExecutionContext["log"], "error" | "info">>;
  }
>): Promise<CodeExecutionResult> => {
  const execution = { log, requestId, sandbox };
  const basePackages = [
    "matplotlib",
    "pandas",
    "numpy",
    "sympy",
    "yfinance",
  ] as const;
  const chartPath = "/tmp/chart.png";

  const baseInstallResult = await installBasePackages(basePackages, execution);
  if (!baseInstallResult.success) {
    return baseInstallResult.result ?? { chart: "", message: "Unknown error" };
  }

  const { codeToRun, installResult } = await processExtraPackages(
    code,
    basePackages,
    execution
  );
  if (!installResult.success) {
    return installResult.result ?? { chart: "", message: "Unknown error" };
  }

  const wrappedCode = createWrappedCode(codeToRun, chartPath);
  const execResult = await sandbox.runCommand({
    args: ["-c", wrappedCode],
    cmd: "python3",
  });

  const { outputText, chartData, execInfo } =
    await parseExecutionOutput(execResult);

  const message = buildResponseMessage({
    execInfo,
    log,
    outputText,
    requestId,
    stderr: await execResult.stderr(),
  });

  if (chartData) {
    log.info({ requestId }, "interactive chart data returned");
    return { chart: chartData, message: message.trim() };
  }

  const chartOut = await checkForChart(chartPath, execution);
  return {
    chart: chartOut ?? "",
    message: message.trim(),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep the generated Python wrapper and its stdout protocol parser together; splitting only to satisfy a file-line quota separates their producer and consumer. */
