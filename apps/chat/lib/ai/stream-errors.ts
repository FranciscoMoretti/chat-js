const FALLBACK_STREAM_ERROR_MESSAGE =
  "An error occurred while generating a response. Please try again.";

const genericErrorMessages = new Set([
  "",
  "An error occurred, please try again!",
  "Something went wrong. Please try again later.",
  FALLBACK_STREAM_ERROR_MESSAGE,
]);

/* oxlint-disable no-magic-numbers, no-ternary, unicorn/no-null --
 * no-magic-numbers (#517): getErrorText uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getErrorText derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * unicorn/no-null (#570): getErrorText preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const getErrorText = (error: unknown): string | null => {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const trimmed = error.message.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
};
/* oxlint-enable no-magic-numbers, no-ternary, unicorn/no-null */

const mapKnownStreamErrorMessage = (message: string): string => {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("ai gateway requires a valid credit card") ||
    (normalized.includes("credit card") && normalized.includes("gateway"))
  ) {
    return "AI Gateway requires a valid credit card. Add one in your Vercel dashboard and try again.";
  }

  if (
    normalized.includes("context window") ||
    normalized.includes("maximum context length") ||
    normalized.includes("prompt is too long") ||
    normalized.includes("too many tokens")
  ) {
    return "This conversation is too long for the selected model. Start a new chat or shorten the message and try again.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "Rate limit exceeded. Please wait a moment and try again.";
  }

  if (
    normalized.includes("model not found") ||
    normalized.includes("model is not available") ||
    normalized.includes("no such model")
  ) {
    return "The selected model is not available right now. Choose another model and try again.";
  }

  return FALLBACK_STREAM_ERROR_MESSAGE;
};

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): getStreamErrorMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getStreamErrorMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const getStreamErrorMessage = (error: unknown): string =>
  mapKnownStreamErrorMessage(
    getErrorText(error) ?? FALLBACK_STREAM_ERROR_MESSAGE
  );
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): getStreamErrorToastContent stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getStreamErrorToastContent API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getStreamErrorToastContent uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getStreamErrorToastContent derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getStreamErrorToastContent uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): getStreamErrorToastContent accepts error: Error; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): getStreamErrorToastContent intentionally keeps the existing falsy-value behavior of rawCause; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getStreamErrorToastContent = (
  error: Error
): {
  description?: string;
  message: string;
} => {
  const rawMessage =
    typeof error.message === "string" ? error.message.trim() : "";
  const rawCause =
    error.cause === null || error.cause === undefined
      ? undefined
      : (getErrorText(error.cause) ?? undefined);

  const rawResolved =
    (rawMessage.length <= 1 || genericErrorMessages.has(rawMessage)) && rawCause
      ? rawCause
      : // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
        rawMessage || rawCause || FALLBACK_STREAM_ERROR_MESSAGE;

  const message = mapKnownStreamErrorMessage(rawResolved);

  if (rawCause && rawCause !== message && !genericErrorMessages.has(rawCause)) {
    return { description: rawCause, message };
  }

  return { message };
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
