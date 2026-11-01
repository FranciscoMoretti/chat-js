import type {
  LanguageModelV4,
  LanguageModelV4Usage,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import {
  reportEveAccountingIssue,
  tryEveAccountingWrite,
} from "./accounting-log";

interface ModelCallScope {
  readonly ownerId: string;
  readonly sessionId: string;
  readonly turnId?: string;
}

interface ModelAttempt extends ModelCallScope {
  readonly eventId: string;
  readonly modelId: string;
  readonly provider: string;
}

interface ModelReceipt {
  readonly response?: ModelResponse;
  readonly usage: {
    readonly inputTokens: Readonly<LanguageModelV4Usage["inputTokens"]>;
    readonly outputTokens: Readonly<LanguageModelV4Usage["outputTokens"]>;
    readonly raw?: Readonly<Record<string, unknown>>;
  };
  readonly providerMetadata?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
}

type ModelResponse = Readonly<
  Pick<
    Extract<LanguageModelV4StreamPart, { type: "response-metadata" }>,
    "id" | "modelId" | "timestamp"
  >
>;

interface ModelLedger {
  // Ownership is required even when accounting storage is best-effort.
  readonly authorize: (attempt: ModelAttempt) => Promise<void>;
  readonly observe?: (
    attempt: ModelAttempt,
    response: ModelResponse
  ) => Promise<void>;
  readonly begin: (attempt: ModelAttempt) => Promise<void>;
  readonly finish: (
    attempt: ModelAttempt,
    receipt: ModelReceipt
  ) => Promise<void>;
}

// A wrapper is scoped to a single resolved session/turn. Refuse accidental nesting.
const MINIMUM_COST = 0;
const accountedModels = new WeakSet<LanguageModelV4>();

const modelReceiptCost = (receipt: ModelReceipt): number | undefined => {
  const raw = receipt.providerMetadata?.gateway?.cost;
  const cost =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : Number.NaN;
  return Number.isFinite(cost) && cost >= MINIMUM_COST ? cost : undefined;
};

const receiptStream = (
  stream: ReadableStream<LanguageModelV4StreamPart>,
  finish: (receipt: ModelReceipt) => Promise<void>,
  observe: (response: ModelResponse) => Promise<void>,
  missingReceipt: () => void
): ReadableStream<LanguageModelV4StreamPart> => {
  const reader = stream.getReader();
  let finished = false;
  let response: ModelResponse | undefined;
  let reportedMissing = false;
  const reportMissing = (): void => {
    if (!finished && !reportedMissing) {
      reportedMissing = true;
      missingReceipt();
    }
  };
  const cancel = async (reason: unknown): Promise<void> => {
    reportMissing();
    try {
      await reader.cancel(reason);
    } finally {
      reader.releaseLock();
    }
  };
  return new ReadableStream(
    {
      cancel,
      async pull(
        controller: ReadonlyNativeSurface<
          ReadableStreamDefaultController<LanguageModelV4StreamPart>
        >
      ): Promise<void> {
        try {
          const next = await reader.read();
          if (next.done) {
            reportMissing();
            reader.releaseLock();
            controller.close();
            return;
          }
          if (next.value.type === "response-metadata") {
            const { id, modelId, timestamp } = next.value;
            response = { id, modelId, timestamp };
            await observe(response);
          }
          if (next.value.type === "finish") {
            if (finished) {
              throw new Error("Model stream returned more than one receipt.");
            }
            await finish({ ...next.value, response });
            finished = true;
          }
          controller.enqueue(next.value);
        } catch (error) {
          controller.error(error);
          try {
            await cancel(error);
          } catch {
            // Preserve the original provider error when cancellation also fails.
          }
        }
      },
    },
    { highWaterMark: 0 }
  );
};

const wrapEveModel = (
  model: LanguageModelV4,
  scope: ModelCallScope,
  ledger: ModelLedger
): LanguageModelV4 => {
  if (accountedModels.has(model)) {
    throw new Error("A model must have exactly one accounting wrapper.");
  }
  const finish = async (
    attempt: ModelAttempt,
    receipt: ModelReceipt
  ): Promise<void> => {
    if (modelReceiptCost(receipt) === undefined) {
      reportEveAccountingIssue(attempt, "missing-cost");
    }
    await tryEveAccountingWrite(attempt, "receipt", async () => {
      await ledger.finish(attempt, receipt);
    });
  };
  const begin = async (): Promise<ModelAttempt> => {
    const attempt = {
      ...scope,
      eventId: `eve-model:${crypto.randomUUID()}`,
      modelId: model.modelId,
      provider: model.provider,
    };
    await ledger.authorize(attempt);
    await tryEveAccountingWrite(attempt, "intent", async () => {
      await ledger.begin(attempt);
    });
    return attempt;
  };
  const wrapped = wrapLanguageModel({
    middleware: {
      specificationVersion: "v4",
      async wrapGenerate({ doGenerate }) {
        const attempt = await begin();
        const result = await Promise.resolve()
          .then(doGenerate)
          .catch((error: unknown) => {
            reportEveAccountingIssue(attempt, "missing-receipt");
            throw error;
          });
        // Attempt persistence before the SDK parses output or EVE validates a summary.
        // Generate already has the response and receipt; persist them atomically.
        const { response } = result;
        await finish(attempt, {
          ...result,
          ...(response === undefined
            ? {}
            : {
                response: {
                  id: response.id,
                  modelId: response.modelId,
                  timestamp: response.timestamp,
                },
              }),
        });
        return result;
      },
      async wrapStream({ doStream }) {
        const attempt = await begin();
        const result = await Promise.resolve()
          .then(doStream)
          .catch((error: unknown) => {
            reportEveAccountingIssue(attempt, "missing-receipt");
            throw error;
          });
        return {
          ...result,
          stream: receiptStream(
            result.stream,
            async (receipt) => {
              await finish(attempt, receipt);
            },
            async (response) => {
              await tryEveAccountingWrite(attempt, "response", async () => {
                await ledger.observe?.(attempt, response);
              });
            },
            () => {
              reportEveAccountingIssue(attempt, "missing-receipt");
            }
          ),
        };
      },
    },
    model,
  });
  accountedModels.add(wrapped);
  return wrapped;
};

export { modelReceiptCost, wrapEveModel };
export type {
  ModelAttempt,
  ModelCallScope,
  ModelLedger,
  ModelReceipt,
  ModelResponse,
};
