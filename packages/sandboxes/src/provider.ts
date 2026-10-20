import type { PersistentSandboxProvider } from "./persistent.ts";

/** Stable, non-secret coordinates. Credential scope may be a fingerprint, never a token. */
interface SandboxScope {
  readonly providerId: string;
  readonly accountId: string;
  readonly scopeId: string;
}
interface Sandbox {
  readonly name: string;
  runCommand: (command: Readonly<{ cmd: string; args: string[] }>) => Promise<{
    exitCode: number;
    stdout: () => Promise<string>;
    stderr: () => Promise<string>;
  }>;
}
interface SandboxProvider {
  readonly persistent?: PersistentSandboxProvider;
  readonly scope: SandboxScope;
  create: (
    options: Readonly<{
      name: string;
      runtime: "python" | "javascript";
      signal: AbortSignal;
    }>
  ) => Promise<Sandbox>;
  /** Successful return proves absence in the original provider scope. */
  deleteAndConfirmAbsent: (name: string) => Promise<void>;
}
interface SandboxOwnership {
  reserve: (scope: SandboxScope, signal: AbortSignal) => Promise<string>;
  created: (name: string) => Promise<void>;
  release: () => Promise<void>;
}
export type { Sandbox, SandboxProvider, SandboxScope, SandboxOwnership };
