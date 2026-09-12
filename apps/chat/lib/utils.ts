import type { FileUIPart, ModelMessage, TextPart } from "ai";
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

import { ChatSDKError } from "./ai/errors";
import type { ErrorCode } from "./ai/errors";
import type { Attachment, ChatMessage } from "./ai/types";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fetchWithErrorHandlers = async (
  ...[input, init]: Parameters<typeof fetch>
): Promise<Response> => {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
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

export const getAttachmentsFromMessage = (message: ChatMessage): Attachment[] =>
  message.parts
    .filter<FileUIPart>((part) => part.type === "file")
    .map((part) => ({
      contentType: part.mediaType,
      name: part.filename || "",
      url: part.url,
    }));

export const getTextContentFromMessage = (message: ChatMessage): string =>
  message.parts
    .filter<TextPart>((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

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
