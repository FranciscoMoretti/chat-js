import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
// The package root resolves to UMD; use ESM so Bun includes it in the Node ESM CLI.
import { parse } from "jsonc-parser/lib/esm/main.js";
import { inferPackageManager } from "./get-package-manager";
import type { PackageManager } from "../types";

// Mirrors the pattern from commands/config.ts but captures stdout for parsing.
const EVAL_SCRIPT = `
import userConfig from "./chat.config.ts";
import { applyDefaults } from "./lib/config-schema";
process.stdout.write(JSON.stringify(applyDefaults(userConfig)));
`;

function getTsEvalCommand(pm: PackageManager): [string, string[]] {
  switch (pm) {
    case "bun":
      return ["bun", ["--eval", EVAL_SCRIPT]];
    case "pnpm":
      return ["pnpm", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    case "yarn":
      return ["yarn", ["dlx", "tsx", "--eval", EVAL_SCRIPT]];
    default:
      return ["npx", ["tsx", "--eval", EVAL_SCRIPT]];
  }
}

export type ProjectConfig = {
  paths: {
    tools: string;
  };
};

export type ProjectUiConfig = {
  alias: string;
};

export async function loadProjectConfig(cwd: string): Promise<ProjectConfig> {
  const pm = inferPackageManager(cwd);
  const [cmd, args] = getTsEvalCommand(pm);

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const out: string[] = [];
    const err: string[] = [];

    child.stdout?.on("data", (d) => out.push(String(d)));
    child.stderr?.on("data", (d) => err.push(String(d)));

    child.on("error", (e) =>
      reject(
        new Error(
          `Could not spawn ${cmd}. Make sure ${pm} is installed.\n${e.message}`
        )
      )
    );

    child.on("close", (code) => {
      if (code === 0) resolve(out.join(""));
      else reject(new Error(`Failed to load config:\n${err.join("").trim()}`));
    });
  });

  const parsed = JSON.parse(stdout);
  return {
    paths: {
      tools: parsed?.paths?.tools ?? "@/tools/chatjs",
    },
  };
}

export async function loadProjectUiConfig(
  cwd: string
): Promise<ProjectUiConfig> {
  const source = await fs.readFile(path.join(cwd, "components.json"), "utf8");
  const parsed: unknown = JSON.parse(source);
  const alias =
    typeof parsed === "object" &&
    parsed !== null &&
    "aliases" in parsed &&
    typeof parsed.aliases === "object" &&
    parsed.aliases !== null &&
    "ui" in parsed.aliases
      ? parsed.aliases.ui
      : null;

  if (typeof alias !== "string" || alias.length === 0) {
    throw new Error('components.json must define a non-empty "aliases.ui"');
  }

  return { alias };
}

/**
 * Resolve a Next.js-style import alias to a filesystem path.
 * "@/tools" → "<cwd>/tools"
 * "./tools" → "<cwd>/tools"
 */
function resolvePathMapping(
  importPath: string,
  pattern: string,
  target: string,
): string | null {
  const wildcardIndex = pattern.indexOf("*");
  if (wildcardIndex === -1) {
    return pattern === importPath ? target : null;
  }

  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);
  if (!(importPath.startsWith(prefix) && importPath.endsWith(suffix))) {
    return null;
  }

  const wildcard = importPath.slice(
    prefix.length,
    importPath.length - suffix.length,
  );
  return target.replace("*", wildcard);
}

function assertProjectPath(resolvedPath: string, cwd: string): string {
  const relative = path.relative(cwd, resolvedPath);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      "Configured project path must resolve inside the project directory",
    );
  }
  return resolvedPath;
}

export async function resolveProjectPath(
  importPath: string,
  cwd: string,
): Promise<string> {
  if (importPath.startsWith("./")) {
    return assertProjectPath(path.resolve(cwd, importPath), cwd);
  }

  let configPath: string | null = null;
  for (const filename of ["tsconfig.json", "jsconfig.json"]) {
    const candidate = path.join(cwd, filename);
    const exists = await fs
      .access(candidate)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      configPath = candidate;
      break;
    }
  }
  if (!configPath) {
    throw new Error(
      "Could not resolve project path without tsconfig.json or jsconfig.json",
    );
  }

  const parsedConfig: unknown = parse(await fs.readFile(configPath, "utf8"));
  const config = (typeof parsedConfig === "object" && parsedConfig !== null
    ? parsedConfig
    : {}) as {
    compilerOptions?: {
      baseUrl?: unknown;
      paths?: Record<string, unknown>;
    };
  };
  const baseUrl =
    typeof config.compilerOptions?.baseUrl === "string"
      ? config.compilerOptions.baseUrl
      : ".";
  const mappings = Object.entries(config.compilerOptions?.paths ?? {}).sort(
    ([left], [right]) => right.length - left.length,
  );

  for (const [pattern, targets] of mappings) {
    if (!Array.isArray(targets) || typeof targets[0] !== "string") {
      continue;
    }
    const mappedPath = resolvePathMapping(importPath, pattern, targets[0]);
    if (mappedPath) {
      return assertProjectPath(path.resolve(cwd, baseUrl, mappedPath), cwd);
    }
  }

  throw new Error(`Could not resolve project path alias "${importPath}"`);
}
