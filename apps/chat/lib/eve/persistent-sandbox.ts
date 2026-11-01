import { defineSandboxProvider } from "eve/sandbox/provider";
import type {
  SandboxProviderImplementation,
  SandboxProviderSessionContext,
  SandboxProviderHandle,
} from "eve/sandbox/provider";
import type { SandboxEnvironment } from "eve/sandbox";
import type { PersistentSandbox } from "@chat-js/sandboxes/persistent";
import { z } from "zod";
import { env } from "../env";
import {
  getSandboxProvider,
  getPersistentSandboxProvider,
} from "../sandbox/runtime";
import { supportsPersistentSandbox } from "@/chatjs/providers/sandbox/provider";
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
type Files = { path: string; content: string }[];
const identityFor = async (
  context: Pick<SandboxProviderSessionContext, "session">
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
): SandboxProviderHandle<PersistentSandbox> => {
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
    // Fence cached handles too: EVE may retain a handle after stop/delete.
    sandbox: {
      name: sandbox.name,
      resolvePath: sandbox.resolvePath,
      run: async (options) =>
        await access(async () => await sandbox.run(options)),
      spawn: async (options) => {
        const process = await access(async () => await sandbox.spawn(options));
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
      readFile: async (options) => {
        const content = await access(
          async () => await sandbox.readFile(options)
        );
        return content === null ? null : stream(content);
      },
      readBinaryFile: async (options) =>
        await access(async () => {
          const path = sandbox.resolvePath(options.path);
          if (
            path.startsWith(
              `${sandbox.resolvePath("/workspace/.eve/attachments")}/`
            )
          ) {
            const original = await readWorkspaceAttachment({ identity, path });
            if (original !== undefined) {
              return original;
            }
          }
          return await sandbox.readBinaryFile(options);
        }),
      readTextFile: async (options) =>
        await access(async () => await sandbox.readTextFile(options)),
      writeFile: async (options) => {
        // The source may be another fenced read; consume it before locking the write.
        const content = new Uint8Array(
          await new Response(options.content).arrayBuffer()
        );
        await access(async () => {
          await sandbox.writeBinaryFile({ ...options, content });
        });
      },
      writeBinaryFile: async (options) => {
        await access(async () => {
          const path = sandbox.resolvePath(options.path);
          if (
            path.startsWith(
              `${sandbox.resolvePath("/workspace/.eve/attachments")}/`
            )
          ) {
            await recordWorkspaceAttachment({
              identity,
              path,
              content: options.content,
            });
          }
          await sandbox.writeBinaryFile(options);
        });
      },
      writeTextFile: async (options) => {
        await access(async () => {
          await sandbox.writeTextFile(options);
        });
      },
      removePath: async (options) => {
        await access(async () => {
          await sandbox.removePath(options);
        });
      },
    },
    onSandboxDelete: async () => {
      await remove(identity);
    },
    onSandboxStop: async () => {
      await stopPersistentWorkspace(identity, getPersistentSandboxProvider);
    },
    onRuntimeShutdown: async () => {
      await stopPersistentWorkspace(identity, getPersistentSandboxProvider);
    },
  };
};

export const appSandboxProvider = (): SandboxProviderImplementation<
  undefined,
  Files,
  { name: string },
  PersistentSandbox
> => ({
  async prepare(context) {
    // Per-session preparation avoids shared remote snapshots and their retention graph.
    const files: Files = [];
    for (const tree of [
      context.resources.workspace,
      context.resources.skills,
    ]) {
      if (!tree) {
        continue;
      }
      for (const file of tree.files) {
        files.push({
          path: `${tree.targetPath}/${file.relativePath}`,
          content: Buffer.from(file.content).toString("base64"),
        });
      }
    }
    return await Promise.resolve(files);
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
        for (const file of artifact) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Initialize each file before confirming the persistent allocation is ready.
          await created.writeBinaryFile({
            path: file.path,
            content: Buffer.from(file.content, "base64"),
            abortSignal: initializationSignal,
          });
        }
        return created;
      },
      reservation.create
    );
    return {
      handle: handle(identity, sandbox),
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
  context: Pick<SandboxProviderSessionContext, "session">
): Promise<void> => {
  if (supportsPersistentSandbox) {
    await registerPersistentSession(await identityFor(context));
  }
};
