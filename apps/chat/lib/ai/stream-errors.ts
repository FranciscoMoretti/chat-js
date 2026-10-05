import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const FALLBACK_STREAM_ERROR_MESSAGE =
  "An error occurred while generating a response. Please try again.";

const genericErrorMessages = new Set([
  "",
  "An error occurred, please try again!",
  "Something went wrong. Please try again later.",
  FALLBACK_STREAM_ERROR_MESSAGE,
]);

/* oxlint-disable unicorn/no-null -- Null means no nonempty error text was extracted; callers use it to select fallback copy. */
const getErrorText = (error: unknown): string | null => {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed === "" ? null : trimmed;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const trimmed = error.message.trim();
    return trimmed === "" ? null : trimmed;
  }

  return null;
};
/* oxlint-enable unicorn/no-null */

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

const getStreamErrorMessage = (error: unknown): string =>
  mapKnownStreamErrorMessage(
    getErrorText(error) ?? FALLBACK_STREAM_ERROR_MESSAGE
  );

const getStreamErrorToastContent = (
  error: ReadonlyNativeSurface<Error>
): {
  description?: string;
  message: string;
} => {
  const rawMessage =
    typeof error.message === "string" ? error.message.trim() : "";
  const rawCause = getErrorText(error.cause);

  // A one-character SDK message can be a truncated stream error; prefer its cause.
  const preferCause =
    // oxlint-disable-next-line no-magic-numbers -- One character is the existing truncation cutoff for streamed error messages.
    rawMessage.length <= 1 || genericErrorMessages.has(rawMessage);
  let rawResolved =
    rawMessage === ""
      ? (rawCause ?? FALLBACK_STREAM_ERROR_MESSAGE)
      : rawMessage;
  if (preferCause && rawCause !== null) {
    rawResolved = rawCause;
  }

  const message = mapKnownStreamErrorMessage(rawResolved);

  if (
    rawCause !== null &&
    rawCause !== message &&
    !genericErrorMessages.has(rawCause)
  ) {
    return { description: rawCause, message };
  }

  return { message };
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getStreamErrorMessage, getStreamErrorToastContent); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { getStreamErrorMessage, getStreamErrorToastContent };
/* oxlint-enable import/no-named-export */
