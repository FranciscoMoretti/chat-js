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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toLowerCase from fileName.split(...).pop(...); preserve one receiver evaluation, skipped accesses and the existing "" fallback. The app guidance prefers optional chaining.
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extensionToLanguage[extension] ?? "python";
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (cn, generateUUID, getLanguageFromFileName); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { cn, generateUUID, getLanguageFromFileName };
/* oxlint-enable import/no-named-export */
