const nativeFetch = globalThis.fetch;
const usage = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

// Preload only in the disposable integration process. The real model selection,
// gateway SDK, agent and credential policy run unchanged.
globalThis.fetch = async (input, init) => {
  let address: string;
  if (typeof input === "string") {
    address = input;
  } else if (input instanceof URL) {
    address = input.href;
  } else {
    address = input.url;
  }
  const url = new URL(address);
  if (
    url.hostname === "ai-gateway.vercel.sh" &&
    url.pathname === "/v1/models"
  ) {
    return new Response("Use the committed fallback model catalog", {
      status: 503,
    });
  }
  if (
    url.hostname === "ai-gateway.vercel.sh" &&
    url.pathname === "/v4/ai/language-model"
  ) {
    const slow =
      typeof init?.body === "string" && init.body.includes("cancel-this-turn");
    const text = "Hello from the actual ChatJS guest agent.";
    if (
      new Headers(init?.headers).get("ai-language-model-streaming") !== "true"
    ) {
      return Response.json({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage,
        warnings: [],
      });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encode = (part: unknown): void => {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(part)}\n\n`)
          );
        };
        const abort = (): void => {
          clearTimeout(timer);
          controller.error(new DOMException("Aborted", "AbortError"));
        };
        stop = () => {
          clearTimeout(timer);
          init?.signal?.removeEventListener("abort", abort);
        };
        if (init?.signal?.aborted === true) {
          abort();
          return;
        }
        encode({ type: "stream-start", warnings: [] });
        encode({ type: "text-start", id: "answer" });
        encode({ type: "text-delta", id: "answer", delta: text });
        init?.signal?.addEventListener("abort", abort, { once: true });
        timer = setTimeout(
          () => {
            stop?.();
            encode({ type: "text-end", id: "answer" });
            encode({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage,
            });
            controller.close();
          },
          slow ? 15_000 : 100
        );
      },
      cancel() {
        stop?.();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  }
  if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return await nativeFetch(input, init);
  }
  throw new Error(
    `External network disabled for guest integration: ${url.hostname}`
  );
};
