/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): ErrorType is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ErrorType stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ErrorType API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "input_too_long"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): Surface is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): Surface stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named Surface API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions";
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): ErrorCode is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ErrorCode stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named ErrorCode API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type ErrorCode = `${ErrorType}:${Surface}`;
/* oxlint-enable import/exports-last, import/group-exports */

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

/* oxlint-disable max-lines-per-function, max-statements --
 * max-lines-per-function (#510): getMessageByErrorCode keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): getMessageByErrorCode keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const getMessageByErrorCode = (errorCode: ErrorCode): string => {
  if (errorCode.includes("database")) {
    return "An error occurred while executing a database query.";
  }

  switch (errorCode) {
    case "bad_request:api": {
      return "The request couldn't be processed. Please check your input and try again.";
    }

    case "unauthorized:auth": {
      return "You need to sign in before continuing.";
    }
    case "forbidden:auth": {
      return "Your account does not have access to this feature.";
    }

    case "rate_limit:chat": {
      return "You have exceeded your maximum number of messages for the day. Please try again later.";
    }
    case "input_too_long:chat": {
      return "Your message input is too long. Please shorten your message and try again.";
    }
    case "not_found:chat": {
      return "The requested chat was not found. Please check the chat ID and try again.";
    }
    case "forbidden:chat": {
      return "This chat belongs to another user. Please check the chat ID and try again.";
    }
    case "unauthorized:chat": {
      return "You need to sign in to view this chat. Please sign in and try again.";
    }
    case "offline:chat": {
      return "We're having trouble sending your message. Please check your internet connection and try again.";
    }

    case "not_found:document": {
      return "The requested document was not found. Please check the document ID and try again.";
    }
    case "forbidden:document": {
      return "This document belongs to another user. Please check the document ID and try again.";
    }
    case "unauthorized:document": {
      return "You need to sign in to view this document. Please sign in and try again.";
    }
    case "bad_request:document": {
      return "The request to create or update the document was invalid. Please check your input and try again.";
    }

    default: {
      return "Something went wrong. Please try again later.";
    }
  }
};
/* oxlint-enable max-lines-per-function, max-statements */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): getStatusCodeByType uses 400, 401, 403, 404, 429, 503, 500 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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

/* oxlint-disable no-console  --
 * import/no-named-export (#527): Preserve the named ChatSDKError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-console (#514): ChatSDKError emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 */
export class ChatSDKError extends Error {
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
/* oxlint-enable no-console */
