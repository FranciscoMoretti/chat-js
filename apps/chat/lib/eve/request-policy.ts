/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { inputResponseSchema } from "eve/client";
// oxlint-disable-next-line sort-imports -- eve/client installs the global Zod postprocessor. Keep it before message-input and ai/types construct app schemas.
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
/* oxlint-disable unicorn/max-nested-calls -- The response schema nests the validated request record inside its bounded array. */
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
          .refine((value) => inputResponseSchema.safeParse(value).success)
      )
      .min(MIN_INPUT_RESPONSES)
      .max(MAX_INPUT_RESPONSES),
  })
  .strict();
/* oxlint-enable unicorn/max-nested-calls */
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
/* oxlint-disable unicorn/no-null -- Unsupported path/method combinations return the existing null policy sentinel. */
const parseSessionRequest = (
  path: string,
  method: string
): {
  sessionId: string;
  schema: typeof cancel | z.ZodUnion<[typeof message, typeof respond]>;
} | null => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- RegExp.exec returns null for nonmatching session paths; first chain preserves the null-policy route rejection. The app guidance prefers optional chaining.
  const groups = sessionPath.exec(path)?.groups;
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
    // oxlint-disable-next-line no-ternary -- Keep schema as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    schema: action === "cancel" ? cancel : z.union([message, respond]),
  };
};
/* oxlint-enable unicorn/no-null */
/* oxlint-disable unicorn/no-null -- * unicorn/no-null (#570): safeStreamQuery preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
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
        (key === "includeTailIndex" || key === "streamControlVersion") &&
        value === "1"
      )
    ) {
      return null;
    }
    result.set(key, value);
  }
  return result;
};
/* oxlint-enable unicorn/no-null */
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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (parseSessionRequest, safeStreamQuery, sameOrigin); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { parseSessionRequest, safeStreamQuery, sameOrigin };
/* oxlint-enable import/no-named-export */
