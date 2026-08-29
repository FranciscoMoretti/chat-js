import type { TreeHelpers } from "@chatjs/thread/react";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ChatMessage } from "@/lib/ai/types";
import type { ParallelRequestSpec } from "./draft-chat-submission";
import { gateChatRequest } from "./gated-chat-transport";

export interface ParallelRequestBody {
  isPrimaryParallel: boolean;
  parallelGroupId: string | null;
  parallelIndex: number;
  selectedModelId: AppModelId;
}

interface UserMessagePersistenceAcknowledgment {
  chatId: string;
  parallelGroupId: string | null;
  userMessageId: string;
}

interface PersistenceGate {
  readonly promise: Promise<void>;
  reject: (error: unknown) => void;
  resolve: () => void;
  readonly settled: boolean;
}

const persistenceGates = new Map<
  string,
  { gate: PersistenceGate; parallelGroupId: string | null }
>();

function persistenceGateKey(chatId: string, userMessageId: string) {
  return `${chatId}:${userMessageId}`;
}

function createPersistenceGate(): PersistenceGate {
  let rejectPromise: (error: unknown) => void = () => undefined;
  let resolvePromise: () => void = () => undefined;
  let settled = false;
  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return {
    promise,
    get settled() {
      return settled;
    },
    reject(error) {
      if (settled) {
        return;
      }
      settled = true;
      rejectPromise(error);
    },
    resolve() {
      if (settled) {
        return;
      }
      settled = true;
      resolvePromise();
    },
  };
}

function registerPersistenceGate({
  chatId,
  message,
}: {
  chatId: string;
  message: ChatMessage;
}) {
  const key = persistenceGateKey(chatId, message.id);
  const previous = persistenceGates.get(key);
  previous?.gate.reject(new Error("Persistence gate replaced"));

  const gate = createPersistenceGate();
  persistenceGates.set(key, {
    gate,
    parallelGroupId: message.metadata.parallelGroupId ?? null,
  });
  return gate;
}

function rejectPersistenceGate({
  chatId,
  error,
  gate,
  userMessageId,
}: {
  chatId: string;
  error: unknown;
  gate: PersistenceGate;
  userMessageId: string;
}) {
  const key = persistenceGateKey(chatId, userMessageId);
  if (persistenceGates.get(key)?.gate === gate) {
    persistenceGates.delete(key);
  }
  gate.reject(error);
}

export function acknowledgeParallelUserMessagePersistence(
  acknowledgment: UserMessagePersistenceAcknowledgment
) {
  const key = persistenceGateKey(
    acknowledgment.chatId,
    acknowledgment.userMessageId
  );
  const entry = persistenceGates.get(key);
  if (!entry || entry.parallelGroupId !== acknowledgment.parallelGroupId) {
    return false;
  }

  persistenceGates.delete(key);
  entry.gate.resolve();
  return true;
}

export function clearParallelPersistenceGates() {
  for (const { gate } of persistenceGates.values()) {
    gate.reject(new Error("Persistence gates cleared"));
  }
  persistenceGates.clear();
}

export function createParallelRequestBody(
  requestSpec: ParallelRequestSpec,
  isPrimaryParallel = requestSpec.isPrimary
): ParallelRequestBody {
  return {
    selectedModelId: requestSpec.modelId,
    parallelGroupId: requestSpec.parallelGroupId,
    parallelIndex: requestSpec.parallelIndex,
    isPrimaryParallel,
  };
}

export async function runParallelThreadRequestSpecs({
  chatId,
  isAuthenticated,
  message,
  projectId,
  requestSpecs,
  startRun,
}: {
  chatId: string;
  isAuthenticated: boolean;
  message: ChatMessage;
  projectId: string | null;
  requestSpecs: ParallelRequestSpec[];
  startRun: TreeHelpers<ChatMessage>["startRun"];
}) {
  const primaryRequest = requestSpecs[0];
  if (!primaryRequest) {
    return [];
  }

  const persistenceGate =
    isAuthenticated && requestSpecs.length > 1
      ? registerPersistenceGate({ chatId, message })
      : null;

  try {
    const primaryRun = await startRun({
      message,
      request: {
        body: {
          ...createParallelRequestBody(primaryRequest, true),
          projectId: projectId ?? undefined,
        },
      },
    });

    const secondaryRuns = await Promise.all(
      requestSpecs.slice(1).map(async (requestSpec) => ({
        requestSpec,
        run: await startRun({
          follow: false,
          from: message.id,
          request: {
            ...(persistenceGate
              ? gateChatRequest(persistenceGate.promise)
              : {}),
            body: {
              ...createParallelRequestBody(requestSpec, false),
              projectId: projectId ?? undefined,
            },
          },
        }),
      }))
    );

    const rejectUnconfirmedPersistence = persistenceGate
      ? primaryRun.finished.then(() => {
          if (!persistenceGate.settled) {
            rejectPersistenceGate({
              chatId,
              error: new Error(
                "Primary response ended before user persistence"
              ),
              gate: persistenceGate,
              userMessageId: message.id,
            });
          }
        })
      : Promise.resolve();

    const runs = [
      { requestSpec: primaryRequest, run: primaryRun },
      ...secondaryRuns,
    ];
    await Promise.all([
      ...runs.map(({ run }) => run.finished),
      rejectUnconfirmedPersistence,
    ]);

    return runs
      .filter(({ run }) => run.getSnapshot()?.status === "error")
      .map(({ requestSpec }) => requestSpec);
  } catch (error) {
    if (persistenceGate) {
      rejectPersistenceGate({
        chatId,
        error,
        gate: persistenceGate,
        userMessageId: message.id,
      });
    }
    throw error;
  }
}
