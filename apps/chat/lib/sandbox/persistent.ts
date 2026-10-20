import type {
  PersistentSandbox,
  PersistentSandboxProvider,
} from "@chat-js/sandboxes/persistent";
import { APIError, Sandbox } from "@vercel/sandbox";
import pathModule from "node:path";
import type { SandboxAuth } from "./adapter";

const { posix } = pathModule;

const OPERATION_TIMEOUT_MS = 30_000;
const SESSION_TIMEOUT_MS = 1_800_000;
const NOT_FOUND = 404;
const resolvePath = (path: string): string => posix.resolve("/workspace", path);
const signal = (upstream?: AbortSignal): AbortSignal =>
  AbortSignal.any([
    AbortSignal.timeout(OPERATION_TIMEOUT_MS),
    ...(upstream ? [upstream] : []),
  ]);

const session = (sandbox: Sandbox): PersistentSandbox => {
  const read: PersistentSandbox["readBinaryFile"] = async (options) =>
    await sandbox.readFileToBuffer(
      { path: resolvePath(options.path) },
      { signal: signal(options.abortSignal) }
    );
  const write: PersistentSandbox["writeBinaryFile"] = async (options) => {
    const path = resolvePath(options.path);
    await sandbox.fs.mkdir(posix.dirname(path), {
      recursive: true,
      signal: signal(options.abortSignal),
    });
    await sandbox.writeFiles(
      [{ path, content: Buffer.from(options.content) }],
      { signal: signal(options.abortSignal) }
    );
  };
  return {
    name: sandbox.name,
    resolvePath,
    readBinaryFile: read,
    writeBinaryFile: write,
    async readFile(options) {
      const bytes = await read(options);
      return bytes === null
        ? null
        : new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          });
    },
    async readTextFile(options) {
      const bytes = await read(options);
      if (bytes === null) {
        return null;
      }
      const text = new TextDecoder(options.encoding ?? "utf-8", {
        fatal: true,
      }).decode(bytes);
      if (options.startLine === undefined && options.endLine === undefined) {
        return text;
      }
      return text
        .split("\n")
        .slice(Math.max(0, (options.startLine ?? 1) - 1), options.endLine)
        .join("\n");
    },
    async writeFile(options) {
      const bytes = new Uint8Array(
        await new Response(options.content).arrayBuffer()
      );
      await write({ ...options, content: bytes });
    },
    async writeTextFile(options) {
      const encoding = options.encoding ?? "utf-8";
      if (!Buffer.isEncoding(encoding)) {
        throw new Error("Unsupported sandbox text encoding.");
      }
      await write({
        ...options,
        content: Buffer.from(options.content, encoding),
      });
    },
    async removePath(options) {
      await sandbox.fs.rm(resolvePath(options.path), {
        force: options.force,
        recursive: options.recursive,
        signal: signal(options.abortSignal),
      });
    },
    async run(options) {
      const deadline = signal(options.abortSignal);
      const result = await sandbox.runCommand({
        cmd: "bash",
        args: ["-lc", options.command],
        cwd: resolvePath(options.workingDirectory ?? "."),
        env: options.env,
        signal: deadline,
      });
      const [stdout, stderr] = await Promise.all([
        result.stdout({ signal: deadline }),
        result.stderr({ signal: deadline }),
      ]);
      return { exitCode: result.exitCode, stdout, stderr };
    },
    async spawn(options) {
      const command = await sandbox.runCommand({
        cmd: "bash",
        args: ["-lc", options.command],
        cwd: resolvePath(options.workingDirectory ?? "."),
        env: options.env,
        signal: signal(options.abortSignal),
        detached: true,
      });
      // Read remote output only on consumer demand; the app fences every pull.
      const logs = command.logs({ signal: signal(options.abortSignal) });
      const iterator = logs[Symbol.asyncIterator]();
      const buffers: Record<"stdout" | "stderr", string[]> = {
        stdout: [],
        stderr: [],
      };
      const cancelled = { stdout: false, stderr: false };
      let done = false;
      let pending: Promise<void> | undefined;
      const advance = async (): Promise<void> => {
        pending ??= (async () => {
          const next = await iterator.next();
          if (next.done === true) {
            done = true;
          } else if (!cancelled[next.value.stream]) {
            buffers[next.value.stream].push(next.value.data);
          }
        })();
        const current = pending;
        try {
          await current;
        } finally {
          if (pending === current) {
            pending = undefined;
          }
        }
      };
      const encoder = new TextEncoder();
      const output = (
        target: "stdout" | "stderr"
      ): ReadableStream<Uint8Array> =>
        new ReadableStream(
          {
            async pull(controller) {
              while (buffers[target].length === 0) {
                if (done) {
                  break;
                }
                // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve multiplexed output order until this consumer has a chunk.
                await advance();
              }
              const chunk = buffers[target].shift();
              if (chunk === undefined) {
                controller.close();
              } else {
                controller.enqueue(encoder.encode(chunk));
              }
            },
            async cancel() {
              cancelled[target] = true;
              buffers[target] = [];
              if (cancelled.stdout && cancelled.stderr) {
                await iterator.return?.();
              }
            },
          },
          { highWaterMark: 0 }
        );
      const stdout = output("stdout");
      const stderr = output("stderr");
      return {
        stdout,
        stderr,
        async wait() {
          const result = await command.wait({
            signal: signal(options.abortSignal),
          });
          return { exitCode: result.exitCode };
        },
        async kill() {
          await command.kill(undefined, { abortSignal: signal() });
        },
      };
    },
  };
};

/** The original credential scope must be verified by the durable owner before use. */
export const createPersistentProvider = (
  auth: SandboxAuth
): PersistentSandboxProvider => {
  const find = async (name: string): Promise<Sandbox | null> => {
    try {
      const sandbox = await Sandbox.get({
        name,
        resume: false,
        signal: signal(),
        ...auth,
      });
      if (sandbox.name !== name || !sandbox.persistent) {
        throw new Error("Persistent sandbox identity mismatch.");
      }
      return sandbox;
    } catch (error) {
      if (error instanceof APIError && error.response.status === NOT_FOUND) {
        return null;
      }
      throw error;
    }
  };
  return {
    async create({ name, signal: abortSignal }) {
      const sandbox = await Sandbox.create({
        name,
        persistent: true,
        image: "vcr.vercel.com/vercel/eve/base:0.80.1",
        timeout: SESSION_TIMEOUT_MS,
        signal: signal(abortSignal),
        ...auth,
      });
      if (sandbox.name !== name || !sandbox.persistent) {
        throw new Error("Persistent sandbox identity mismatch.");
      }
      return session(sandbox);
    },
    async open(name) {
      const sandbox = await find(name);
      if (sandbox === null) {
        throw new Error(
          "Persistent sandbox is missing; replacement is forbidden."
        );
      }
      return session(sandbox);
    },
    async stop(name) {
      const sandbox = await find(name);
      if (sandbox !== null) {
        await sandbox.stop({ signal: signal() });
      }
    },
    async deleteAndConfirmAbsent(name) {
      const sandbox = await find(name);
      if (sandbox !== null) {
        await sandbox.delete({ deleteOrphanSnapshots: true, signal: signal() });
      }
      if (await find(name)) {
        throw new Error("Persistent sandbox deletion is unconfirmed.");
      }
    },
  };
};
