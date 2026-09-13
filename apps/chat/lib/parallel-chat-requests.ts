import type { TreeHelpers } from "@chat-js/thread/react";

import type { AppModelId } from "@/lib/ai/app-model-id";
import type { ChatMessage } from "@/lib/ai/types";

import type { ParallelRequestSpec } from "./draft-chat-submission";
import { gateChatRequest } from "./gated-chat-transport";

export interface ParallelRequestBody {
  isPrimaryParallel: boolean;
  parallelGroupId: string | null;
  parallelIndex: number;
  requestId: string;
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
  {
    gate: PersistenceGate;
    parallelGroupId: string | null;
  }
>();
const persistenceGateKey = (chatId: string, userMessageId: string) =>
  `${chatId}:${userMessageId}`;
const observeRejection = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch {
    // The secondary transport receives the original gate rejection.
  }
};

const noop = () => {
  // Replaced synchronously by the promise executor.
};

const createPersistenceGate = (): PersistenceGate => {
  let rejectPromise: (error: unknown) => void = noop;
  let resolvePromise: () => void = noop;
  let settled = false;
  const promise = new Promise<void>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });
  void observeRejection(promise);
  return {
    promise,
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
    get settled() {
      return settled;
    },
  };
};

const registerPersistenceGate = ({
  chatId,
  message,
}: {
  chatId: string;
  message: ChatMessage;
}) => {
  const key = persistenceGateKey(chatId, message.id);
  const previous = persistenceGates.get(key);
  previous?.gate.reject(new Error("Persistence gate replaced"));
  const gate = createPersistenceGate();
  persistenceGates.set(key, {
    gate,
    parallelGroupId: message.metadata.parallelGroupId ?? null,
  });
  return gate;
};

const rejectPersistenceGate = ({
  chatId,
  error,
  gate,
  userMessageId,
}: {
  chatId: string;
  error: unknown;
  gate: PersistenceGate;
  userMessageId: string;
}) => {
  const key = persistenceGateKey(chatId, userMessageId);
  if (persistenceGates.get(key)?.gate === gate) {
    persistenceGates.delete(key);
  }
  gate.reject(error);
};

const rejectWhenPrimaryFinishes = async ({
  chatId,
  gate,
  primaryFinished,
  userMessageId,
}: {
  chatId: string;
  gate: PersistenceGate;
  primaryFinished: Promise<unknown>;
  userMessageId: string;
}) => {
  try {
    await primaryFinished;
  } catch {
    // The caller handles a failed primary run separately.
    return;
  }
  if (!gate.settled) {
    rejectPersistenceGate({
      chatId,
      error: new Error("Primary response ended before user persistence"),
      gate,
      userMessageId,
    });
  }
};

export const acknowledgeParallelUserMessagePersistence = (
  acknowledgment: UserMessagePersistenceAcknowledgment
) => {
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
};

export const clearParallelPersistenceGates = () => {
  for (const { gate } of persistenceGates.values()) {
    gate.reject(new Error("Persistence gates cleared"));
  }
  persistenceGates.clear();
};

export const createParallelRequestBody = (
  requestSpec: ParallelRequestSpec,
  isPrimaryParallel = requestSpec.isPrimary
): ParallelRequestBody => ({
  isPrimaryParallel,
  parallelGroupId: requestSpec.parallelGroupId,
  parallelIndex: requestSpec.parallelIndex,
  requestId: requestSpec.requestId,
  selectedModelId: requestSpec.modelId,
});
export const runParallelThreadRequestSpecs = async ({
  chatId,
  isAuthenticated,
  message,
  projectId,
  requestSpecs,
  onRunStarted,
  startRun,
}: {
  chatId: string;
  isAuthenticated: boolean;
  message: ChatMessage;
  projectId: string | null;
  requestSpecs: ParallelRequestSpec[];
  onRunStarted: (input: {
    parallelGroupId: string;
    parallelIndex: number;
    runId: string;
  }) => void;
  startRun: TreeHelpers<ChatMessage>["startRun"];
}) => {
  const [primaryRequest] = requestSpecs;
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
    if (primaryRequest.parallelGroupId) {
      onRunStarted({
        parallelGroupId: primaryRequest.parallelGroupId,
        parallelIndex: primaryRequest.parallelIndex,
        runId: primaryRun.id,
      });
    }
    const secondaryRuns = await Promise.all(
      requestSpecs.slice(1).map(async (requestSpec) => {
        const run = await startRun({
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
        });
        if (requestSpec.parallelGroupId) {
          onRunStarted({
            parallelGroupId: requestSpec.parallelGroupId,
            parallelIndex: requestSpec.parallelIndex,
            runId: run.id,
          });
        }
        return { requestSpec, run };
      })
    );
    const rejectUnconfirmedPersistence = persistenceGate
      ? rejectWhenPrimaryFinishes({
          chatId,
          gate: persistenceGate,
          primaryFinished: primaryRun.finished,
          userMessageId: message.id,
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
};
