import { expect, test } from "@playwright/test";
import { APIError, Sandbox } from "@vercel/sandbox";
import { eveCodeSandboxName } from "../lib/eve/code-sandbox-name";
import { createModuleLogger } from "../lib/logger";
import { executeJavaScriptInSandbox } from "../tools/platform/code-execution.javascript";
import { executePythonInSandbox } from "../tools/platform/code-execution.python";
import {
  cleanupSandbox,
  createSandbox,
  getTokenAuth,
} from "../tools/platform/code-execution.shared";

for (const language of ["javascript", "python"] as const) {
  test(`Sandbox SDK executes ${language} and removes the disposable resource`, async () => {
    test.setTimeout(120_000);
    const name = eveCodeSandboxName({
      ownerId: "local-sdk-fixture",
      sessionId: crypto.randomUUID(),
      callId: language,
    });
    const sandbox = await createSandbox(
      language === "javascript" ? "node22" : "python3.13",
      AbortSignal.timeout(30_000),
      name
    );
    const log = createModuleLogger("sandbox-sdk-test");
    const requestId = crypto.randomUUID();
    try {
      expect(sandbox.persistent).toBe(false);
      expect(sandbox.name).toBe(name);
      const context = {
        sandbox,
        log,
        requestId,
        code: language === "javascript" ? "console.log(6 * 7)" : "print(6 * 7)",
      };
      const result =
        language === "javascript"
          ? await executeJavaScriptInSandbox(context)
          : await executePythonInSandbox(context);
      expect(result.message).toContain("42");
    } finally {
      await cleanupSandbox(sandbox, log, requestId);
    }
    let removed = false;
    try {
      await Sandbox.get({
        name: sandbox.name,
        resume: false,
        signal: AbortSignal.timeout(15_000),
        ...getTokenAuth(),
      });
    } catch (error) {
      removed = error instanceof APIError && error.response.status === 404;
    }
    expect(
      removed,
      "Deleted sandbox must no longer be retrievable by its exact name"
    ).toBe(true);
  });
}
