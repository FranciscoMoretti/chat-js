import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";
import { defineSandboxProvider } from "eve/sandbox/provider";
import type {
  SandboxProviderImplementation,
  SandboxSessionContext,
  SandboxConnection,
} from "eve/sandbox/provider";
import type { SandboxEnvironment } from "eve/sandbox";
import type { PersistentSandbox } from "@chat-js/sandboxes/persistent";
import { z } from "zod";
import { env } from "../env";
import {
  getSandboxProvider,
  getPersistentSandboxProvider,
} from "../sandbox/runtime";
import { supportsPersistentSandbox } from "../sandbox/provider";
import {
  accessPersistentSandbox,
  cleanupPersistentSession,
  resolvePersistentIdentity,
  stopPersistentWorkspace,
  reservePersistentSandbox,
  retirePersistentSession,
  registerPersistentSession,
} from "./persistent-sandbox-store";
import type { SessionIdentity } from "./persistent-sandbox-store";
import {
  recordWorkspaceAttachment,
  readWorkspaceAttachment,
} from "./workspace-attachments";

const stateSchema = z.object({ name: z.string().min(1) });
type Files = {
  path: string;
  content: string;
  location: "workspace" | "skills";
}[];
const identityFor = async (
  context: Pick<SandboxSessionContext, "session">
): Promise<SessionIdentity> => {
  if (
    env.NODE_ENV === "development" &&
    env.CHATJS_SANDBOX_DEV_RUN_ID === undefined
  ) {
    throw new Error(
      "App-owned persistent sandboxes require bun dev:supervise in development."
    );
  }
  const sessionId = context.session.id;
  const rootSessionId = context.session.parent?.rootSessionId ?? sessionId;
  const reservationId =
    context.session.auth.initiator?.attributes?.chatjsReservationId;
  return await resolvePersistentIdentity({
    sessionId,
    rootSessionId,
    ownerId: context.session.auth.initiator?.principalId,
    reservationId:
      typeof reservationId === "string" ? reservationId : undefined,
    devRunId: env.CHATJS_SANDBOX_DEV_RUN_ID,
  });
};

const remove = async (identity: SessionIdentity): Promise<void> => {
  await retirePersistentSession(identity);
  await cleanupPersistentSession(identity, getPersistentSandboxProvider);
};

const handle = (
  identity: SessionIdentity,
  sandbox: PersistentSandbox
): SandboxConnection => {
  const infrastructure = getSandboxProvider();
  const { persistent } = infrastructure;
  if (!persistent) {
    throw new Error("Persistent sandbox provider is unavailable.");
  }
  const access = async <T>(operation: () => Promise<T>): Promise<T> =>
    await accessPersistentSandbox(
      identity,
      infrastructure.scope,
      sandbox.name,
      operation
    );
  const stream = (
    source: ReadableStream<Uint8Array>
  ): ReadableStream<Uint8Array> => {
    const reader = source.getReader();
    return new ReadableStream(
      {
        async pull(controller) {
          const next = await access(async () => await reader.read());
          if (next.done) {
            reader.releaseLock();
            controller.close();
          } else {
            controller.enqueue(next.value);
          }
        },
        async cancel(reason: unknown) {
          try {
            await access(async () => {
              await reader.cancel(reason);
            });
          } finally {
            reader.releaseLock();
          }
        },
      },
      { highWaterMark: 0 }
    );
  };
  return {
    workspaceRoot: "/workspace",
    spawn: async (options) => {
      if (options.stdin === true) {
        throw new Error("The installed sandbox does not support stdin.");
      }
      const process = await access(
        async () =>
          await sandbox.spawn({
            ...options,
            env: { ...options.env },
            abortSignal: options.signal,
          })
      );
      return {
        stdout: stream(process.stdout),
        stderr: stream(process.stderr),
        wait: async () => await access(async () => await process.wait()),
        kill: async () => {
          await access(async () => {
            await process.kill();
          });
        },
      };
    },
    readFile: async (options) =>
      await access(async () => {
        const path = sandbox.resolvePath(options.path);
        if (path.startsWith("/workspace/.eve/attachments/")) {
          const original = await readWorkspaceAttachment({ identity, path });
          if (original !== undefined) {
            return original;
          }
        }
        return await sandbox.readBinaryFile({
          path,
          abortSignal: options.signal,
        });
      }),
    writeFiles: async (options) => {
      for (const file of options.files) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Fence each write before the next file can be staged.
        await access(async () => {
          const path = sandbox.resolvePath(file.path);
          if (path.startsWith("/workspace/.eve/attachments/")) {
            await recordWorkspaceAttachment({
              identity,
              path,
              content: file.content,
            });
          }
          await sandbox.writeBinaryFile({
            ...file,
            path,
            abortSignal: options.signal,
          });
        });
      }
    },
    removePath: async (options) => {
      await access(async () => {
        await sandbox.removePath({ ...options, abortSignal: options.signal });
      });
    },
    stop: async () => {
      await stopPersistentWorkspace(identity, getPersistentSandboxProvider);
    },
  };
};

export const appSandboxProvider = (): SandboxProviderImplementation<
  undefined,
  Files,
  { name: string },
  object
> => ({
  async prepare(context) {
    const resources = await context.resourcesDirectory();
    if (resources === undefined || resources === "") {
      return [];
    }
    const groups = await Promise.all(
      (["workspace", "skills"] as const).map(
        async (location): Promise<Files> => {
          const root = nodePath.join(resources, location);
          let entries;
          try {
            entries = await readdir(root, {
              recursive: true,
              withFileTypes: true,
            });
          } catch (error) {
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            ) {
              return [];
            }
            throw error;
          }
          return await Promise.all(
            entries
              .filter((entry) => entry.isFile())
              .map(async (entry) => {
                const filePath = nodePath.join(entry.parentPath, entry.name);
                const content = await readFile(filePath);
                return {
                  location,
                  path: nodePath.relative(root, filePath),
                  content: content.toString("base64"),
                };
              })
          );
        }
      )
    );
    return groups.flat();
  },
  async start(context, _options, artifact) {
    const identity = await identityFor(context);
    const infrastructure = getSandboxProvider();
    const { persistent } = infrastructure;
    if (!persistent) {
      throw new Error(
        "The installed sandbox provider does not support persistent filesystems."
      );
    }
    const reservation = await reservePersistentSandbox(
      identity,
      infrastructure.scope
    );
    const sandbox = await accessPersistentSandbox(
      identity,
      infrastructure.scope,
      reservation.name,
      async () => {
        if (!reservation.create) {
          return await persistent.open(reservation.name);
        }
        const initializationSignal = AbortSignal.timeout(30_000);
        const created = await persistent.create({
          name: reservation.name,
          signal: initializationSignal,
        });
        let home = "";
        if (artifact.some((file) => file.location === "skills")) {
          const result = await created.run({
            command: 'printf "%s" "$HOME"',
            abortSignal: initializationSignal,
          });
          if (result.exitCode !== 0 || !result.stdout.startsWith("/")) {
            throw new Error("Sandbox home directory is unavailable.");
          }
          home = result.stdout.trim();
        }
        for (const file of artifact) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Initialize each file before confirming the persistent allocation is ready.
          await created.writeBinaryFile({
            path:
              file.location === "skills"
                ? `${home}/.agents/skills/${file.path}`
                : `/workspace/${file.path}`,
            content: Buffer.from(file.content, "base64"),
            abortSignal: initializationSignal,
          });
        }
        return created;
      },
      reservation.create
    );
    return {
      connection: handle(identity, sandbox),
      state: { name: reservation.name },
    };
  },
  async resume(context, _artifact, rawState) {
    const { name } = stateSchema.parse(rawState);
    const identity = await identityFor(context);
    const infrastructure = getSandboxProvider();
    const { persistent } = infrastructure;
    if (!persistent) {
      throw new Error("Persistent sandbox provider is unavailable.");
    }
    const sandbox = await accessPersistentSandbox(
      identity,
      infrastructure.scope,
      name,
      async () => await persistent.open(name)
    );
    return handle(identity, sandbox);
  },
  async onSessionEnd(context) {
    const identity = await identityFor(context);
    await remove(identity);
  },
});
const provider = defineSandboxProvider({
  name: "chatjs-persistent",
  environment: appSandboxProvider,
});

/** EVE consumes the installed app provider; lifecycle ownership stays in ChatJS. */
export const createPersistentSandboxEnvironment = (): SandboxEnvironment =>
  provider.environment();

export const registerAppSandboxSession = async (
  context: Pick<SandboxSessionContext, "session">
): Promise<void> => {
  if (supportsPersistentSandbox) {
    await registerPersistentSession(await identityFor(context));
  }
};
