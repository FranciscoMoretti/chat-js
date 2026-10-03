/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { ModelMessage } from "ai";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

import { ChatSDKError } from "./ai/errors";
import type { ErrorCode } from "./ai/errors";
/* oxlint-enable sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): cn stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named cn API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): cn accepts ...inputs: ClassValue[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): fetchWithErrorHandlers stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named fetchWithErrorHandlers API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * oxc/no-async-await (#540): fetchWithErrorHandlers sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): fetchWithErrorHandlers accepts ...[input, init]: Parameters<typeof fetch>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const fetchWithErrorHandlers = async (
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
/* oxlint-enable import/group-exports, import/no-named-export, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): generateUUID stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named generateUUID API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const generateUUID = (): string => uuidv7();
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable id-length, import/group-exports, import/no-named-export, max-lines-per-function, oxc/no-optional-chaining, typescript/strict-boolean-expressions --
 * id-length (#506): getLanguageFromFileName uses R; c; h; r as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): getLanguageFromFileName stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getLanguageFromFileName API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-lines-per-function (#510): getLanguageFromFileName keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-optional-chaining (#542): getLanguageFromFileName handles optional fileName.split(".").pop()?.toLowerCase() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/strict-boolean-expressions (#610): getLanguageFromFileName intentionally keeps the existing falsy-value behavior of fileName.split(".").pop()?.toLowerCase(); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const getLanguageFromFileName = (fileName: string): string => {
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
/* oxlint-enable id-length, import/group-exports, import/no-named-export, max-lines-per-function, oxc/no-optional-chaining, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): getTextContentFromModelMessage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getTextContentFromModelMessage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): getTextContentFromModelMessage accepts message: ModelMessage; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const getTextContentFromModelMessage = (
  message: ModelMessage
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
/* oxlint-enable import/group-exports, import/no-named-export, typescript/prefer-readonly-parameter-types */
