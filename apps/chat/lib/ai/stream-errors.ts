const FALLBACK_STREAM_ERROR_MESSAGE =
  "An error occurred while generating a response. Please try again.";

const genericErrorMessages = new Set([
  "",
  "An error occurred, please try again!",
  "Something went wrong. Please try again later.",
  FALLBACK_STREAM_ERROR_MESSAGE,
]);

function getErrorText(error: unknown): string | null {
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
}

function mapKnownStreamErrorMessage(message: string): string {
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
}

export function getStreamErrorMessage(error: unknown): string {
  return mapKnownStreamErrorMessage(
    getErrorText(error) ?? FALLBACK_STREAM_ERROR_MESSAGE
  );
}

export function getStreamErrorToastContent(error: Error): {
  description?: string;
  message: string;
} {
  const rawMessage =
    typeof error.message === "string" ? error.message.trim() : "";
  const rawCause =
    error.cause === null || error.cause === undefined
      ? undefined
      : (getErrorText(error.cause) ?? undefined);

  const rawResolved =
    (rawMessage.length <= 1 || genericErrorMessages.has(rawMessage)) && rawCause
      ? rawCause
      : rawMessage || rawCause || FALLBACK_STREAM_ERROR_MESSAGE;

  const message = mapKnownStreamErrorMessage(rawResolved);

  if (rawCause && rawCause !== message && !genericErrorMessages.has(rawCause)) {
    return { message, description: rawCause };
  }

  return { message };
}
