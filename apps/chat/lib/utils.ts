import type { ModelMessage } from "ai";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

import { ChatSDKError } from "./ai/errors";
import type { ErrorCode } from "./ai/errors";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

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

export const generateUUID = (): string => uuidv7();

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
