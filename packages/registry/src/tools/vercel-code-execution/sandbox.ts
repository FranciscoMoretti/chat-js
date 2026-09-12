import { Sandbox } from "@vercel/sandbox";

import { env } from "@/lib/env";
import type { createModuleLogger } from "@/lib/logger";

import type { SupportedExecutionLanguage } from "./types";

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

export function createSandbox(runtime: string): Promise<Sandbox> {
  return Sandbox.create({
    runtime,
    timeout: 5 * 60 * 1000,
    resources: { vcpus: 2 },
    ...getTokenAuth(),
  });
}

export async function cleanupSandbox(
  sandbox: Sandbox | undefined,
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<void> {
  if (!sandbox) {
    return;
  }
  try {
    await sandbox.stop();
    log.info({ requestId }, "sandbox closed");
  } catch (error) {
    log.warn({ requestId, closeErr: error }, "failed to close sandbox");
  }
}

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}
