import type {
  LanguageModelV4,
  LanguageModelV4Usage,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { wrapLanguageModel } from "ai";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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

const receiptStream = (
  stream: ReadableStream<LanguageModelV4StreamPart>,
  finish: (receipt: ModelReceipt) => Promise<void>,
  observe: (response: ModelResponse) => Promise<void>
): ReadableStream<LanguageModelV4StreamPart> => {
  const reader = stream.getReader();
  let finished = false;
  const cancel = async (reason: unknown): Promise<void> => {
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
            reader.releaseLock();
            controller.close();
            return;
          }
          if (next.value.type === "response-metadata") {
            await observe(next.value);
          }
          if (next.value.type === "finish") {
            if (finished) {
              throw new Error("Model stream returned more than one receipt.");
            }
            await finish(next.value);
            finished = true;
          }
          controller.enqueue(next.value);
        } catch (error) {
          controller.error(error);
          try {
            await cancel(error);
          } catch {
            // Preserve the original provider/storage error when cancellation also fails.
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
  const begin = async (): Promise<ModelAttempt> => {
    const attempt = {
      ...scope,
      eventId: `eve-model:${crypto.randomUUID()}`,
      modelId: model.modelId,
      provider: model.provider,
    };
    await ledger.begin(attempt);
    return attempt;
  };
  const wrapped = wrapLanguageModel({
    middleware: {
      specificationVersion: "v4",
      async wrapGenerate({ doGenerate }) {
        const attempt = await begin();
        const result = await doGenerate();
        if (result.response !== undefined) {
          await ledger.observe?.(attempt, result.response);
        }
        // Persist before the SDK parses structured output or EVE validates a summary.
        await ledger.finish(attempt, result);
        return result;
      },
      async wrapStream({ doStream }) {
        const attempt = await begin();
        const result = await doStream();
        return {
          ...result,
          stream: receiptStream(
            result.stream,
            async (receipt) => {
              await ledger.finish(attempt, receipt);
            },
            async (response) => {
              await ledger.observe?.(attempt, response);
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

const modelReceiptCost = (receipt: ModelReceipt): number | undefined => {
  const raw = receipt.providerMetadata?.gateway?.cost;
  const cost =
    typeof raw === "number" || (typeof raw === "string" && raw.trim() !== "")
      ? Number(raw)
      : Number.NaN;
  return Number.isFinite(cost) && cost >= MINIMUM_COST ? cost : undefined;
};

export { modelReceiptCost, wrapEveModel };
export type {
  ModelAttempt,
  ModelCallScope,
  ModelLedger,
  ModelReceipt,
  ModelResponse,
};
