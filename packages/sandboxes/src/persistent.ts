/** Persistent filesystems are a separate capability from disposable command execution. */
interface FileOptions {
  path: string;
  abortSignal?: AbortSignal;
}
interface ProcessOptions {
  command: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
}
interface PersistentProcess {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  wait: () => Promise<{ exitCode: number }>;
  kill: () => Promise<void>;
}
interface PersistentSandbox {
  readonly name: string;
  resolvePath: (path: string) => string;
  run: (
    options: ProcessOptions
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  spawn: (options: ProcessOptions) => Promise<PersistentProcess>;
  readFile: (
    options: FileOptions
  ) => Promise<ReadableStream<Uint8Array> | null>;
  readBinaryFile: (options: FileOptions) => Promise<Uint8Array | null>;
  readTextFile: (
    options: FileOptions & {
      encoding?: string;
      startLine?: number;
      endLine?: number;
    }
  ) => Promise<string | null>;
  writeFile: (
    options: FileOptions & { content: ReadableStream<Uint8Array> }
  ) => Promise<void>;
  writeBinaryFile: (
    options: FileOptions & { content: Uint8Array }
  ) => Promise<void>;
  writeTextFile: (
    options: FileOptions & { content: string; encoding?: string }
  ) => Promise<void>;
  removePath: (
    options: FileOptions & { force?: boolean; recursive?: boolean }
  ) => Promise<void>;
}
interface PersistentSandboxProvider {
  /** Only the allocation owner may call create; a failed response is uncertain. */
  create: (options: {
    name: string;
    signal?: AbortSignal;
  }) => Promise<PersistentSandbox>;
  /** Attach to the exact resource; never replace a missing resource. */
  open: (name: string) => Promise<PersistentSandbox>;
  /** Preserve files, but not running processes. */
  stop: (name: string) => Promise<void>;
  deleteAndConfirmAbsent: (name: string) => Promise<void>;
}
export type { PersistentSandbox, PersistentSandboxProvider, PersistentProcess };
