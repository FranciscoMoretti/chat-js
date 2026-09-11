import { Sandbox } from "@vercel/sandbox";
import { env } from "@/lib/env";
import type { createModuleLogger } from "@/lib/logger";
import type { SupportedExecutionLanguage } from "./code-execution.types";

export function getTokenAuth(): Record<string, string> {
  const { VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = env;
  if (VERCEL_TEAM_ID && VERCEL_PROJECT_ID && VERCEL_TOKEN) {
    return {
      teamId: VERCEL_TEAM_ID,
      projectId: VERCEL_PROJECT_ID,
      token: VERCEL_TOKEN,
    };
  }
  return {};
}

export function getSandboxRuntime(
  language: SupportedExecutionLanguage
): string {
  if (language === "javascript") {
    return env.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT ?? "node22";
  }

  return (
    env.VERCEL_SANDBOX_RUNTIME_PYTHON ??
    env.VERCEL_SANDBOX_RUNTIME ??
    "python3.13"
  );
}

export function createSandbox(
  runtime: string,
  signal?: AbortSignal,
  name?: string
): Promise<Sandbox> {
  return Sandbox.create({
    runtime,
    persistent: false,
    name,
    signal,
    timeout: 5 * 60 * 1000,
    resources: { vcpus: 2 },
    ...getTokenAuth(),
  });
}

export async function cleanupSandbox(
  sandbox: Pick<Sandbox, "stop" | "delete"> | undefined,
  log: Pick<ReturnType<typeof createModuleLogger>, "info" | "warn">,
  requestId: string
): Promise<void> {
  if (!sandbox) {
    return;
  }
  try {
    try {
      await sandbox.stop({ signal: AbortSignal.timeout(30_000) });
    } finally {
      await sandbox.delete({
        deleteOrphanSnapshots: true,
        signal: AbortSignal.timeout(30_000),
      });
    }
    log.info({ requestId }, "sandbox closed");
  } catch (closeErr) {
    log.warn({ requestId, closeErr }, "failed to close sandbox");
    throw closeErr;
  }
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
