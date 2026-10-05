type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "input_too_long"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions";

type ErrorCode = `${ErrorType}:${Surface}`;

type ErrorVisibility = "response" | "log" | "none";

const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  api: "response",
  auth: "response",
  chat: "response",
  database: "log",
  document: "response",
  history: "response",
  stream: "response",
  suggestions: "response",
  vote: "response",
};

const messageByErrorCode: Partial<Record<ErrorCode, string>> = {
  "bad_request:api":
    "The request couldn't be processed. Please check your input and try again.",
  "bad_request:document":
    "The request to create or update the document was invalid. Please check your input and try again.",
  "forbidden:auth": "Your account does not have access to this feature.",
  "forbidden:chat":
    "This chat belongs to another user. Please check the chat ID and try again.",
  "forbidden:document":
    "This document belongs to another user. Please check the document ID and try again.",
  "input_too_long:chat":
    "Your message input is too long. Please shorten your message and try again.",
  "not_found:chat":
    "The requested chat was not found. Please check the chat ID and try again.",
  "not_found:document":
    "The requested document was not found. Please check the document ID and try again.",
  "offline:chat":
    "We're having trouble sending your message. Please check your internet connection and try again.",
  "rate_limit:chat":
    "You have exceeded your maximum number of messages for the day. Please try again later.",
  "unauthorized:auth": "You need to sign in before continuing.",
  "unauthorized:chat":
    "You need to sign in to view this chat. Please sign in and try again.",
  "unauthorized:document":
    "You need to sign in to view this document. Please sign in and try again.",
};

const getMessageByErrorCode = (errorCode: ErrorCode): string => {
  if (errorCode.includes("database")) {
    return "An error occurred while executing a database query.";
  }
  if (Object.hasOwn(messageByErrorCode, errorCode)) {
    return (
      messageByErrorCode[errorCode] ??
      "Something went wrong. Please try again later."
    );
  }
  return "Something went wrong. Please try again later.";
};

/* oxlint-disable no-magic-numbers --
 * Numeric results are HTTP status codes for each public error type; the fallback is an internal server error (500).
 */
const getStatusCodeByType = (type: ErrorType): number => {
  switch (type) {
    case "bad_request":
    case "input_too_long": {
      return 400;
    }
    case "unauthorized": {
      return 401;
    }
    case "forbidden": {
      return 403;
    }
    case "not_found": {
      return 404;
    }
    case "rate_limit": {
      return 429;
    }
    case "offline": {
      return 503;
    }
    default: {
      return 500;
    }
  }
};
/* oxlint-enable no-magic-numbers */

class ChatSDKError extends Error {
  public name = "ChatSDKError";
  public type: ErrorType;
  public surface: Surface;
  public statusCode: number;

  public constructor(errorCode: ErrorCode, cause?: string) {
    super(getMessageByErrorCode(errorCode));

    const [type, surface] = errorCode.split(":");

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: ErrorCode is a constrained type: splitting its colon-delimited value loses the component unions in TypeScript.
    this.type = type as ErrorType;
    this.cause = cause;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: ErrorCode is a constrained type: splitting its colon-delimited value loses the component unions in TypeScript.
    this.surface = surface as Surface;
    this.statusCode = getStatusCodeByType(this.type);
  }

  public toResponse(): Response {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      // oxlint-disable-next-line no-console -- Database errors are redacted from the HTTP body; retain their operational details in the existing server error log.
      console.error({
        cause,
        code,
        message,
      });

      return Response.json(
        { code: "", message: "Something went wrong. Please try again later." },
        { status: statusCode }
      );
    }

    return Response.json({ cause, code, message }, { status: statusCode });
  }
}

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ChatSDKError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { ChatSDKError };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ErrorCode, ErrorType, Surface); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ErrorCode, ErrorType, Surface };
/* oxlint-enable import/no-named-export */
