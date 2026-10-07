import type { ModelMessage } from "ai";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

import { ChatSDKError, isErrorCode } from "./ai/errors";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): cn accepts ...inputs: ClassValue[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): fetchWithErrorHandlers accepts ...[input, init]: Parameters<typeof fetch>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const errorFromResponse = (body: unknown): Error => {
  if (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    isErrorCode(body.code)
  ) {
    return "cause" in body && typeof body.cause === "string"
      ? new ChatSDKError(body.code, body.cause)
      : new ChatSDKError(body.code);
  }
  // Hidden database errors omit their internal code but keep a public message.
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : "Something went wrong. Please try again later.";
  return new Error(message);
};

const fetchWithErrorHandlers = async (
  ...[input, init]: Parameters<typeof fetch>
): Promise<Response> => {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      throw errorFromResponse(await response.json());
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const generateUUID = (): string => uuidv7();

/* oxlint-disable id-length, max-lines-per-function, typescript/strict-boolean-expressions -- id-length (#506): getLanguageFromFileName uses R; c; h; r as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
max-lines-per-function (#510): getLanguageFromFileName keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/strict-boolean-expressions (#610): getLanguageFromFileName intentionally keeps the existing falsy-value behavior of fileName.split(".").pop()?.toLowerCase(); distinguishing empty, zero, and absent states requires a domain behavior decision. */
const getLanguageFromFileName = (fileName: string): string => {
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  const extensionToLanguage: Record<string, string> = {
    R: "r",
    bash: "shell",
    c: "c",
    cc: "cpp",
    cjs: "javascript",
    cpp: "cpp",
    cs: "csharp",
    css: "css",
    cxx: "cpp",
    fish: "shell",
    go: "go",
    h: "c",
    hpp: "cpp",
    htm: "html",
    html: "html",
    java: "java",
    js: "javascript",
    json: "json",
    jsx: "jsx",
    kt: "kotlin",
    less: "css",
    md: "markdown",
    mdx: "markdown",
    mjs: "javascript",
    php: "php",
    py: "python",
    pyi: "python",
    pyw: "python",
    r: "r",
    rb: "ruby",
    rs: "rust",
    sass: "css",
    scss: "css",
    sh: "shell",
    sql: "sql",
    swift: "swift",
    toml: "toml",
    ts: "typescript",
    tsx: "tsx",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    zsh: "shell",
  };

  // Default to Python.
  return extensionToLanguage[extension] || "python";
};
/* oxlint-enable id-length, max-lines-per-function, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): getTextContentFromModelMessage accepts message: ModelMessage; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const getTextContentFromModelMessage = (message: ModelMessage): string => {
  const { content } = message;

  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }
      return "";
    })
    .join("\n");
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export {
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  getLanguageFromFileName,
  getTextContentFromModelMessage,
};
