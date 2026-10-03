/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { inputResponseSchema } from "eve/client";
import { z } from "zod";

import { frontendToolsSchema } from "../ai/types";
import { eveMessageInput } from "./message-input";
/* oxlint-enable import/no-relative-parent-imports */

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
/* oxlint-disable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): parseSessionRequest stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): parseSessionRequest uses 1, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep parseSessionRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep parseSessionRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): parseSessionRequest intentionally keeps the existing falsy-value behavior of match?.[1]; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): parseSessionRequest preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const parseSessionRequest = (path: string, method: string) => {
  const match = sessionPath.exec(path);
  if (!match?.[1]) {
    return null;
  }
  const { 2: action } = match;
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
};
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null */
/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/group-exports (#523): safeStreamQuery stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/explicit-function-return-type (#560): Keep safeStreamQuery's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep safeStreamQuery's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): safeStreamQuery accepts params: URLSearchParams; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): safeStreamQuery preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const safeStreamQuery = (params: URLSearchParams) => {
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
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): sameOrigin stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/explicit-function-return-type (#560): Keep sameOrigin's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep sameOrigin's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): sameOrigin accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): sameOrigin intentionally keeps the existing falsy-value behavior of supplied; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const sameOrigin = (request: Request, origin: string) => {
  const supplied = request.headers.get("origin");
  return supplied
    ? supplied === origin
    : request.method === "GET" &&
        request.headers.get("sec-fetch-site") !== "cross-site";
};
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
