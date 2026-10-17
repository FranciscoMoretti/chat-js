import type {
  LanguageModelV4,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
} from "@ai-sdk/provider";
import { APICallError } from "@ai-sdk/provider";
import { generateText, Output } from "ai";
import { expect, it, vi } from "vitest";
import { z } from "zod";

import { modelReceiptCost, wrapEveModel } from "./model-ledger";
import type { ModelLedger } from "./model-ledger";

const scope = { ownerId: "owner", sessionId: "session", turnId: "turn_1" };
const result: LanguageModelV4GenerateResult = {
  content: [{ text: "invalid JSON", type: "text" }],
  finishReason: { raw: "stop", unified: "stop" },
  providerMetadata: { gateway: { cost: "0.012", generationId: "generation" } },
  usage: {
    inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
    outputTokens: { reasoning: 0, text: 2, total: 2 },
  },
  warnings: [],
};
const ledger = (): ModelLedger => ({
  begin: vi.fn(async () => {
    /* Durable intent mock */
    await Promise.resolve();
  }),
  finish: vi.fn(async () => {
    /* Durable receipt mock */
    await Promise.resolve();
  }),
});
const model = (
  generate = vi.fn(async () => await Promise.resolve(result))
): LanguageModelV4 => ({
  doGenerate: generate,
  doStream: async () => await Promise.reject(new Error("Unexpected stream")),
  modelId: "mock",
  provider: "mock",
  specificationVersion: "v4",
  supportedUrls: {},
});

it("records cost before structured-output validation rejects a paid response", async () => {
  const store = ledger();
  const wrapped = wrapEveModel(model(), scope, store);
  const schema = z.object({ answer: z.string() });
  const generation = generateText({
    maxRetries: 0,
    model: wrapped,
    output: Output.object({ schema }),
    prompt: "mock",
  });
  await expect(generation).rejects.toThrow();
  expect(store.begin).toHaveBeenCalledOnce();
  expect(store.finish).toHaveBeenCalledWith(
    expect.objectContaining(scope),
    result
  );
});

it("fails closed before the provider when intent persistence fails", async () => {
  const store = ledger();
  const generate = vi.fn(async () => await Promise.resolve(result));
  vi.mocked(store.begin).mockRejectedValue(new Error("storage unavailable"));
  await expect(
    wrapEveModel(model(generate), scope, store).doGenerate({ prompt: [] })
  ).rejects.toThrow("storage unavailable");
  expect(generate).not.toHaveBeenCalled();
});

it("gives retries distinct intents and does not fabricate a zero-cost receipt for failures", async () => {
  const store = ledger();
  const generate = vi
    .fn(async () => await Promise.resolve(result))
    .mockRejectedValueOnce(
      new APICallError({
        isRetryable: true,
        message: "retry",
        requestBodyValues: {},
        statusCode: 503,
        url: "mock://provider",
      })
    );
  await generateText({
    maxRetries: 1,
    model: wrapEveModel(model(generate), scope, store),
    prompt: "mock",
  });
  const attempts = vi
    .mocked(store.begin)
    .mock.calls.map(([attempt]) => attempt.eventId);
  expect(new Set(attempts).size).toBe(2);
  expect(store.finish).toHaveBeenCalledOnce();
});

it("preserves pull-driven streaming, request data, signal and cancellation without eager draining", async () => {
  const store = ledger();
  const pull = vi.fn();
  const cancel = vi.fn();
  const { signal } = new AbortController();
  const provider: LanguageModelV4 = {
    ...model(),
    doStream: async (params) => {
      expect(params.abortSignal).toBe(signal);
      return await Promise.resolve({
        request: { body: "request" },
        response: { headers: { kept: "yes" } },
        stream: new ReadableStream<LanguageModelV4StreamPart>(
          {
            cancel,
            pull(controller) {
              pull();
              controller.enqueue({ type: "stream-start", warnings: [] });
            },
          },
          { highWaterMark: 0 }
        ),
      });
    },
  };
  const streamed = await wrapEveModel(provider, scope, store).doStream({
    abortSignal: signal,
    prompt: [],
  });
  expect(streamed.request?.body).toBe("request");
  expect(streamed.response?.headers).toEqual({ kept: "yes" });
  expect(pull).not.toHaveBeenCalled();
  const reader = streamed.stream.getReader();
  await reader.read();
  expect(pull).toHaveBeenCalledOnce();
  await reader.cancel("cancelled");
  expect(cancel).toHaveBeenCalledWith("cancelled");
  expect(store.begin).toHaveBeenCalledOnce();
  expect(store.finish).not.toHaveBeenCalled();
});

it("persists stream finish before exposing it, including empty summaries", async () => {
  const store = ledger();
  const receiptWrite = Promise.withResolvers<boolean>();
  vi.mocked(store.finish).mockImplementation(async () => {
    await receiptWrite.promise;
  });
  const finish: LanguageModelV4StreamPart = {
    finishReason: result.finishReason,
    providerMetadata: result.providerMetadata,
    type: "finish",
    usage: result.usage,
  };
  const provider: LanguageModelV4 = {
    ...model(),
    doStream: async () =>
      await Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue(finish);
            controller.close();
          },
        }),
      }),
  };
  const streamed = await wrapEveModel(provider, scope, store).doStream({
    prompt: [],
  });
  const reader = streamed.stream.getReader();
  const delivered = vi.fn();
  const read = (async (): Promise<
    ReadableStreamReadResult<LanguageModelV4StreamPart>
  > => {
    const part = await reader.read();
    delivered();
    return part;
  })();
  await vi.waitFor(() => {
    expect(store.finish).toHaveBeenCalledOnce();
  });
  expect(delivered).not.toHaveBeenCalled();
  receiptWrite.resolve(true);
  const received = await read;
  expect(received.value).toEqual(finish);
  await reader.read();
});

it("leaves an intent unresolved on stream errors and rejected receipt writes", async () => {
  const store = ledger();
  const failure = new Error("lost stream");
  const provider: LanguageModelV4 = {
    ...model(),
    doStream: async () =>
      await Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            controller.error(failure);
          },
        }),
      }),
  };
  const streamed = await wrapEveModel(provider, scope, store).doStream({
    prompt: [],
  });
  await expect(streamed.stream.getReader().read()).rejects.toBe(failure);
  expect(store.finish).not.toHaveBeenCalled();
  vi.mocked(store.finish).mockRejectedValue(new Error("lost receipt"));
  await expect(
    wrapEveModel(model(), scope, store).doGenerate({ prompt: [] })
  ).rejects.toThrow("lost receipt");
  expect(store.begin).toHaveBeenCalledTimes(2);
});

it("rejects duplicate wrapper installation", () => {
  const store = ledger();
  const wrapped = wrapEveModel(model(), scope, store);
  expect(() => wrapEveModel(wrapped, scope, store)).toThrow("exactly one");
});

it.each(["", " ", "bad", -1, "-1", Number.POSITIVE_INFINITY])(
  "keeps invalid cost %s unknown",
  (cost) => {
    expect(
      modelReceiptCost({ ...result, providerMetadata: { gateway: { cost } } })
    ).toBeUndefined();
  }
);

it("distinguishes known zero from missing cost", () => {
  expect(
    modelReceiptCost({
      ...result,
      providerMetadata: { gateway: { cost: "0" } },
    })
  ).toBe(0);
  expect(modelReceiptCost({ usage: result.usage })).toBeUndefined();
});

it("retains response identifiers when a stream ends before its finish receipt", async () => {
  const store = {
    ...ledger(),
    observe: vi.fn(async () => {
      await Promise.resolve();
    }),
  };
  const response = {
    type: "response-metadata" as const,
    id: "early-id",
    modelId: "provider-model",
  };
  const stream = new ReadableStream<LanguageModelV4StreamPart>({
    start(controller) {
      controller.enqueue(response);
      controller.close();
    },
  });
  const wrapped = wrapEveModel(
    {
      ...model(),
      doStream: async () =>
        await Promise.resolve(await Promise.resolve({ stream })),
    },
    scope,
    store
  );
  const streamed = await wrapped.doStream({ prompt: [] });
  const reader = streamed.stream.getReader();
  expect(await reader.read()).toEqual({ done: false, value: response });
  expect(store.observe).toHaveBeenCalledWith(expect.objectContaining(scope), {
    id: response.id,
    modelId: response.modelId,
  });
  const end = await reader.read();
  expect(end.done).toBe(true);
  expect(store.finish).not.toHaveBeenCalled();
});

it("persists generated response identifiers and cost in one receipt write", async () => {
  const store = { ...ledger(), observe: vi.fn() };
  const response = {
    id: "generated-id",
    timestamp: new Date(),
    modelId: "mock",
  };
  const generated = {
    ...result,
    response: { ...response, body: { private: true } },
  };
  const generate = vi.fn(async () => await Promise.resolve(generated));
  await wrapEveModel(model(generate), scope, store).doGenerate({ prompt: [] });
  expect(store.observe).not.toHaveBeenCalled();
  expect(store.finish).toHaveBeenCalledWith(expect.objectContaining(scope), {
    ...result,
    response,
  });
});

it("retains the final cost receipt after an early metadata write fails", async () => {
  const store = {
    ...ledger(),
    observe: vi.fn().mockRejectedValue(new Error("transient storage failure")),
  };
  const response = { id: "stream-id", modelId: "mock", timestamp: new Date() };
  const finish: LanguageModelV4StreamPart = {
    type: "finish",
    finishReason: result.finishReason,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
  };
  const provider: LanguageModelV4 = {
    ...model(),
    doStream: async () =>
      await Promise.resolve({
        stream: new ReadableStream<LanguageModelV4StreamPart>({
          start(controller) {
            controller.enqueue({ ...response, type: "response-metadata" });
            controller.enqueue(finish);
            controller.close();
          },
        }),
      }),
  };
  const streamed = await wrapEveModel(provider, scope, store).doStream({
    prompt: [],
  });
  const reader = streamed.stream.getReader();
  await reader.read();
  expect(await reader.read()).toEqual({ done: false, value: finish });
  expect(store.finish).toHaveBeenCalledWith(expect.objectContaining(scope), {
    ...finish,
    response,
  });
  const end = await reader.read();
  expect(end.done).toBe(true);
});
