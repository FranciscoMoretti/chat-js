/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { inputResponseSchema } from "eve/client";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { frontendToolsSchema } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */

import { eveMessageInput } from "./message-input";

const streamIndex = /^\d{1,12}$/u;
const sessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)(?:\/(?<operation>stream|cancel))?$/u;
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): message uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const message = z
  .object({
    message: eveMessageInput,
    selectedTool: frontendToolsSchema.optional(),
    modelId: z.string().min(1).max(200).optional(),
  })
  .strict();
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): respond uses 1, 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/max-nested-calls (#568): respond keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): cancel uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
// Attached/resumed EVE clients cancel the active turn without a turn ID.
const cancel = z
  .object({ turnId: z.string().min(1).max(200).optional() })
  .strict();
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/no-null -- Unsupported path/method combinations return the existing null policy sentinel. */
const parseSessionRequest = (
  path: string,
  method: string
): {
  sessionId: string;
  schema: typeof cancel | z.ZodUnion<[typeof message, typeof respond]>;
} | null => {
  const groups = sessionPath.exec(path)?.groups;
  const sessionId = groups?.sessionId;
  if (typeof sessionId !== "string") {
    return null;
  }
  const action = groups?.operation;
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
    if (
      key === "startIndex"
        ? !streamIndex.test(value)
        : !(
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
  return supplied !== null && supplied !== ""
    ? supplied === origin
    : request.method === "GET" &&
        request.headers.get("sec-fetch-site") !== "cross-site";
};

export { parseSessionRequest, safeStreamQuery, sameOrigin };
