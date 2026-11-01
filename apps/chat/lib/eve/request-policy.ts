import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { eveMessageInput } from "./message-input";
import { frontendToolsSchema } from "@/lib/ai/types";
import { z } from "zod";

const MIN_IDENTIFIER_LENGTH = 1;
const MAX_MODEL_IDENTIFIER_LENGTH = 200;
const MAX_TURN_IDENTIFIER_LENGTH = 200;
const MIN_INPUT_RESPONSES = 1;
const MAX_INPUT_RESPONSES = 16;

const streamIndex = /^\d{1,12}$/u;
const sessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)(?:\/(?<operation>stream|cancel))?$/u;
const message = z
  .object({
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    modelId: z
      .string()
      .min(MIN_IDENTIFIER_LENGTH)
      .max(MAX_MODEL_IDENTIFIER_LENGTH)
      .optional(),
  })
  .strict();
const respond = z
  .object({
    inputResponses: z
      .array(
        z
          .object({
            requestId: z.string().min(MIN_IDENTIFIER_LENGTH),
            optionId: z.string().optional(),
            text: z.string().optional(),
          })
          .strict()
      )
      .min(MIN_INPUT_RESPONSES)
      .max(MAX_INPUT_RESPONSES),
  })
  .strict();
// Attached/resumed EVE clients cancel the active turn without a turn ID.
const cancel = z
  .object({
    turnId: z
      .string()
      .min(MIN_IDENTIFIER_LENGTH)
      .max(MAX_TURN_IDENTIFIER_LENGTH)
      .optional(),
  })
  .strict();
const parseSessionRequest = (
  path: string,
  method: string
): {
  sessionId: string;
  schema: typeof cancel | z.ZodUnion<[typeof message, typeof respond]>;
} | null => {
  const { groups } = sessionPath.exec(path) ?? {};
  if (!groups) {
    return null;
  }
  const { sessionId } = groups;
  if (typeof sessionId !== "string") {
    return null;
  }
  const action = groups.operation;
  if (
    !(
      (method === "GET" && action === "stream") ||
      (method === "POST" && (typeof action !== "string" || action === "cancel"))
    )
  ) {
    return null;
  }
  return {
    sessionId,
    schema: action === "cancel" ? cancel : z.union([message, respond]),
  };
};
const safeStreamQuery = (
  params: ReadonlyNativeSurface<URLSearchParams>
): URLSearchParams | null => {
  const result = new URLSearchParams();
  for (const [key, value] of params) {
    if (result.has(key)) {
      return null;
    }
    if (key === "startIndex") {
      if (!streamIndex.test(value)) {
        return null;
      }
    } else if (
      !(
        ((key === "includeTailIndex" || key === "streamControlVersion") &&
          value === "1") ||
        (key === "follow" && value === "false")
      )
    ) {
      return null;
    }
    result.set(key, value);
  }
  return result;
};
const sameOrigin = (
  request: ReadonlyNativeSurface<Request>,
  origin: string
): boolean => {
  const supplied = request.headers.get("origin");
  if (supplied !== null && supplied !== "") {
    return supplied === origin;
  }
  return (
    request.method === "GET" &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
};

export { parseSessionRequest, safeStreamQuery, sameOrigin };
