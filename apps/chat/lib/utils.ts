import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { v7 as uuidv7 } from "uuid";

type ClassNameInput =
  | Exclude<ClassValue, object>
  | Readonly<Record<string, unknown>>
  | readonly ClassNameInput[];

const cn = (...inputs: readonly ClassNameInput[]): string =>
  twMerge(clsx(inputs));

const generateUUID = (): string => uuidv7();

const extensionToLanguage: Readonly<Record<string, string>> = {
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

const getLanguageFromFileName = (fileName: string): string => {
  const extension = (fileName.split(".").pop() ?? "").toLowerCase();
  return extensionToLanguage[extension] ?? "python";
};

export { cn, generateUUID, getLanguageFromFileName };
