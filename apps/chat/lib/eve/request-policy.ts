import { inputResponseSchema } from "eve/client";
import { z } from "zod";
import { frontendToolsSchema } from "../ai/types";
import { eveMessageInput } from "./message-input";

const streamIndex = /^\d{1,12}$/;
const sessionPath =
  /^\/eve\/v1\/session\/([A-Za-z0-9_-]+)(?:\/(stream|cancel))?$/;
const message = z
  .object({
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    modelId: z.string().min(1).max(200).optional(),
  })
  .strict();
const respond = z
  .object({
    inputResponses: z
      .array(
        z
          .object({
            requestId: z.string().min(1),
            optionId: z.string().optional(),
            text: z.string().optional(),
          })
          .strict()
          .refine((value) => inputResponseSchema.safeParse(value).success)
      )
      .min(1)
      .max(16),
  })
  .strict();
// Attached/resumed EVE clients cancel the active turn without a turn ID.
const cancel = z
  .object({ turnId: z.string().min(1).max(200).optional() })
  .strict();

export function parseSessionRequest(path: string, method: string) {
  const match = sessionPath.exec(path);
  if (!match?.[1]) {
    return null;
  }
  const action = match[2];
  if (
    !(
      (method === "GET" && action === "stream") ||
      (method === "POST" && (!action || action === "cancel"))
    )
  ) {
    return null;
  }
  return {
    sessionId: match[1],
    schema: action === "cancel" ? cancel : z.union([message, respond]),
  };
}
export function safeStreamQuery(params: URLSearchParams) {
  const result = new URLSearchParams();
  for (const [key, value] of params) {
    if (result.has(key)) {
      return null;
    }
    if (
      key === "startIndex"
        ? !streamIndex.test(value)
        : !(key === "includeTailIndex" && value === "1")
    ) {
      return null;
    }
    result.set(key, value);
  }
  return result;
}
export function sameOrigin(request: Request, origin: string) {
  const supplied = request.headers.get("origin");
  return supplied
    ? supplied === origin
    : request.method === "GET" &&
        request.headers.get("sec-fetch-site") !== "cross-site";
}
