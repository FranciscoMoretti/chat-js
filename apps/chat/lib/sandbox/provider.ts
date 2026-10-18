import type { SandboxProvider } from "@chat-js/sandboxes/provider";
import {
  createCleanupSession,
  createSandbox,
  getSandboxImage,
  resolveSandboxAuth,
} from "./adapter";

export const createSandboxProvider = (): SandboxProvider => {
  const auth = resolveSandboxAuth();
  const cleanup = createCleanupSession(auth);
  return {
    scope: {
      providerId: "vercel",
      accountId: auth.teamId,
      scopeId: auth.projectId,
    },
    create: async ({ name, runtime, signal }) =>
      await createSandbox(getSandboxImage(runtime), signal, name, auth),
    deleteAndConfirmAbsent: cleanup.deleteAndConfirmAbsent,
  };
};
