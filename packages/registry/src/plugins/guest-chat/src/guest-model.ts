import type { SessionModel } from "@/chatjs/core/session/contracts";
import type { LanguageModelMiddleware } from "ai";
import { wrapLanguageModel } from "ai";
import { GUEST_POLICY } from "@/chatjs/plugins/guest-chat/guest-policy";
import { resolveEveModel } from "@/lib/eve/model-selection";

const MAX_OUTPUT_CHARACTERS = GUEST_POLICY.maxOutputTokens * 16;

/** Enforce bounds at the provider call, including accumulated conversation history. */
export const guestModelMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v4",
  // AI SDK requires a promise-returning middleware; validation itself is synchronous.
  // oxlint-disable-next-line eslint/require-await
  transformParams: async ({ params }) => {
    if (
      JSON.stringify(params.prompt).length > GUEST_POLICY.maxInputCharacters ||
      params.prompt.some(
        (message) =>
          message.role === "tool" ||
          (typeof message.content !== "string" &&
            message.content.some(
              (part) =>
                part.type !== "text" &&
                !(message.role === "assistant" && part.type === "reasoning")
            ))
      )
    ) {
      throw new Error("Guest input limit reached. Start a new chat.");
    }
    return {
      ...params,
      // Reserve the small guest output budget for the visible answer.
      providerOptions: {
        ...params.providerOptions,
        openai: {
          ...params.providerOptions?.openai,
          reasoningEffort: "minimal",
        },
      },
      tools: [],
      toolChoice: { type: "none" },
      maxOutputTokens: GUEST_POLICY.maxOutputTokens,
      abortSignal: params.abortSignal
        ? AbortSignal.any([params.abortSignal, AbortSignal.timeout(60_000)])
        : AbortSignal.timeout(60_000),
    };
  },
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    if (result.content.some((part) => part.type === "tool-call")) {
      throw new Error("Guest models cannot invoke tools.");
    }
    const characters = result.content.reduce(
      (total, part) =>
        total +
        (part.type === "text" || part.type === "reasoning"
          ? part.text.length
          : 0),
      0
    );
    if (characters > MAX_OUTPUT_CHARACTERS) {
      throw new Error("Guest output limit reached.");
    }
    return result;
  },
  wrapStream: async ({ doStream }) => {
    const result = await doStream();
    let characters = 0;
    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            if (
              part.type === "tool-call" ||
              part.type === "tool-input-start" ||
              part.type === "tool-input-delta" ||
              part.type === "tool-input-end"
            ) {
              throw new Error("Guest models cannot invoke tools.");
            }
            if (part.type === "text-delta" || part.type === "reasoning-delta") {
              characters += part.delta.length;
              if (characters > MAX_OUTPUT_CHARACTERS) {
                throw new Error("Guest output limit reached.");
              }
            }
            controller.enqueue(part);
          },
        })
      ),
    };
  },
};

export const resolveGuestModel = async (): Promise<SessionModel> => {
  const resolved = await resolveEveModel(GUEST_POLICY.modelId);
  return {
    ...resolved,
    modelContextWindowTokens: Math.min(resolved.modelContextWindowTokens, 8192),
    model: wrapLanguageModel({
      model: resolved.model,
      middleware: guestModelMiddleware,
    }),
  };
};
