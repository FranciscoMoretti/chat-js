import type { ModelMessage } from "ai";
import { clsx } from "clsx";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ClassValue } from "clsx";
/* oxlint-enable sort-imports */
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ChatSDKError } from "./ai/errors";
/* oxlint-enable sort-imports */
import type { ErrorCode } from "./ai/errors";
import type { ReadonlyNativeSurface } from "./readonly-native-surface";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): cn accepts ...inputs: ClassValue[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchWithErrorHandlers's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): fetchWithErrorHandlers accepts ...[input, init]: Parameters<typeof fetch>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const fetchWithErrorHandlers = async (
  ...[input, init]: Parameters<typeof fetch>
): Promise<Response> => {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: The fetch wrapper consumes the application error-code envelope; introducing runtime envelope validation requires choosing fallback error behavior for malformed responses.
      const { code, cause } = await response.json();
      // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-type-assertion -- #594: The fetch wrapper consumes the application error-code envelope; introducing runtime envelope validation requires choosing fallback error behavior for malformed responses. #599: The fetch wrapper consumes the application error-code envelope; introducing runtime envelope validation requires choosing fallback error behavior for malformed responses.
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const generateUUID = (): string => uuidv7();

const extensionToLanguage: Readonly<Record<string, string>> = {
  bash: "shell",
  // oxlint-disable-next-line id-length -- The standardized .c filename extension is the lookup key.
  c: "c",
  cc: "cpp",
  cjs: "javascript",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  cxx: "cpp",
  fish: "shell",
  go: "go",
  // oxlint-disable-next-line id-length -- The standardized .h filename extension is the lookup key.
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
  // oxlint-disable-next-line id-length -- The standardized .r filename extension is the lookup key.
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

const getLanguageFromFileName = (fileName: string): string => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extensionToLanguage[extension] ?? "python";
};

const getTextContentFromModelMessage = (
  message: ReadonlyNativeSurface<ModelMessage>
): string => {
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
export {
  cn,
  fetchWithErrorHandlers,
  generateUUID,
  getLanguageFromFileName,
  getTextContentFromModelMessage,
};
