/**
 * Build script — generates items/*.json and index.json from src/{name}/.
 *
 * Each tool directory must contain:
 *   tool.ts       — backend tool implementation
 *   renderer.tsx  — frontend renderer component
 *   meta.json     — { description, extraDependencies? }
 *
 * npm dependencies are auto-detected from import statements in tool.ts and
 * renderer.tsx. Use extraDependencies in meta.json only for packages that are
 * loaded dynamically (e.g. via require()) and would be missed by static analysis.
 *
 * Run: bun run build
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Node, Project, SyntaxKind } from "ts-morph";
import {
  readStaticToolMetadata,
  type StaticToolEnvVar,
  type StaticToolEnvVars,
} from "./src/static-tool-metadata";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const appToolsDir = fileURLToPath(
  new URL("../../apps/chat/tools/chatjs", import.meta.url)
);
const itemsDir = fileURLToPath(new URL("./items", import.meta.url));
const indexPath = fileURLToPath(new URL("./index.json", import.meta.url));
const checkMode = process.argv.includes("--check");

async function emitGeneratedFile(
  filePath: string,
  content: string
): Promise<void> {
  if (!checkMode) {
    await fs.writeFile(filePath, content);
    return;
  }

  const existing = await fs.readFile(filePath, "utf8").catch(() => null);
  if (existing !== content) {
    throw new Error(
      `Generated registry file is out of date: ${path.relative(process.cwd(), filePath)}`
    );
  }
}

// Node.js built-in module names (node: prefix is handled separately)
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "console", "constants",
  "crypto", "dgram", "dns", "domain", "events", "fs", "http", "http2",
  "https", "module", "net", "os", "path", "perf_hooks", "process",
  "punycode", "querystring", "readline", "repl", "stream", "string_decoder",
  "sys", "timers", "tls", "trace_events", "tty", "url", "util", "v8",
  "vm", "worker_threads", "zlib",
]);

/**
 * Extract npm package names from static import/export statements in source code.
 * Filters out relative imports, Node built-ins, and the node: protocol.
 */
function extractNpmImports(source: string): string[] {
  const specifiers = new Set<string>();
  const project = new Project({
    useInMemoryFileSystem: true,
    skipAddingFilesFromTsConfig: true,
  });
  const sourceFile = project.createSourceFile("file.ts", source);

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    if (importDeclaration.isTypeOnly()) {
      continue;
    }

    const moduleSpecifier = importDeclaration.getModuleSpecifierValue();
    const pkg = getImportPackage(moduleSpecifier);
    if (pkg) {
      specifiers.add(pkg);
    }
  }

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    if (exportDeclaration.isTypeOnly()) {
      continue;
    }

    const moduleSpecifier = exportDeclaration.getModuleSpecifierValue();
    const pkg = moduleSpecifier ? getImportPackage(moduleSpecifier) : null;
    if (pkg) {
      specifiers.add(pkg);
    }
  }

  for (const node of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = node.getExpression();
    if (!Node.isImportExpression(expression)) {
      continue;
    }

    const [argument] = node.getArguments();
    if (!argument || !Node.isStringLiteral(argument)) {
      continue;
    }

    const pkg = getImportPackage(argument.getLiteralValue());
    if (pkg) {
      specifiers.add(pkg);
    }
  }

  return [...specifiers].sort();
}

function getImportPackage(spec: string): string | null {
  if (
    spec.startsWith(".") || // relative
    spec.startsWith("/") || // absolute path
    spec.startsWith("node:") || // explicit node: protocol
    spec.startsWith("@/") || // app path alias
    spec.startsWith("@toolkit/") || // registry-owned shared helpers
    spec.startsWith("@ui/") // consumer UI components
  ) {
    return null;
  }

  const pkg = spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : spec.split("/")[0];

  return NODE_BUILTINS.has(pkg) ? null : pkg;
}

type Meta = {
  description: string;
  hidden?: boolean;
  projectRequirements?: Array<"storage">;
  extraDependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{
    source: string;
    target: string;
    type: "tool" | "renderer" | "lib" | "component" | "hook" | "ui";
  }>;
};

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

async function main(): Promise<void> {
  await fs.mkdir(itemsDir, { recursive: true });

  const entries = (await fs.readdir(srcDir)).sort();
  const dirs: string[] = [];
  for (const entry of entries) {
    const stat = await fs.stat(path.join(srcDir, entry));
    if (stat.isDirectory()) dirs.push(entry);
  }

  const index: Array<{
    name: string;
    description: string;
    hidden?: boolean;
    projectRequirements?: Array<"storage">;
  }> = [];

  for (const name of dirs) {
    const dir = path.join(srcDir, name);

    const meta: Meta = JSON.parse(
      await fs.readFile(path.join(dir, "meta.json"), "utf8")
    );
    const appDir = path.join(appToolsDir, name);
    const registryFiles: Array<{
      path: string;
      type: "tool" | "renderer" | "lib" | "component" | "hook" | "ui";
      target: string;
      content: string;
    }> = [];

    const detected = new Set<string>();
    let toolEnvVars: StaticToolEnvVars = [];

    const registryToolPath = path.join(dir, "tool.ts");
    const registryRendererPath = path.join(dir, "renderer.tsx");
    const toolPath =
      (await fileExists(registryToolPath))
        ? registryToolPath
        : path.join(appDir, "tool.ts");
    const rendererPath =
      (await fileExists(registryRendererPath))
        ? registryRendererPath
        : path.join(appDir, "renderer.tsx");

    if (await fileExists(toolPath)) {
      const toolContent = await fs.readFile(toolPath, "utf8");
      registryFiles.push({
        path: "tool.ts",
        type: "tool",
        target: `${name}/tool.ts`,
        content: toolContent,
      });
      for (const dependency of extractNpmImports(toolContent)) {
        detected.add(dependency);
      }
      const metadata = readStaticToolMetadata(toolContent);
      toolEnvVars = metadata.toolEnvVars;
    }

    if (await fileExists(rendererPath)) {
      const rendererContent = await fs.readFile(rendererPath, "utf8");
      registryFiles.push({
        path: "renderer.tsx",
        type: "renderer",
        target: `${name}/renderer.tsx`,
        content: rendererContent,
      });
      for (const dependency of extractNpmImports(rendererContent)) {
        detected.add(dependency);
      }
    }

    for (const file of meta.files ?? []) {
      const content = await fs.readFile(path.join(dir, file.source), "utf8");
      registryFiles.push({
        path: file.source,
        type: file.type,
        target: file.target,
        content,
      });
      for (const dependency of extractNpmImports(content)) {
        detected.add(dependency);
      }
    }

    for (const dep of meta.extraDependencies ?? []) detected.add(dep);
    const dependencies = [...detected].sort();
    const projectRequirements = [
      ...new Set(meta.projectRequirements ?? []),
    ].sort();

    const item = {
      name,
      description: meta.description,
      ...(meta.hidden ? { hidden: true } : {}),
      ...(dependencies.length > 0 ? { dependencies } : {}),
      ...(meta.devDependencies?.length
        ? { devDependencies: [...new Set(meta.devDependencies)].sort() }
        : {}),
      ...(meta.registryDependencies?.length
        ? {
            registryDependencies: [
              ...new Set(meta.registryDependencies),
            ].sort(),
          }
        : {}),
      ...(toolEnvVars.length > 0 ? { envRequirements: toolEnvVars } : {}),
      ...(projectRequirements.length > 0 ? { projectRequirements } : {}),
      files: registryFiles,
    };

    await emitGeneratedFile(
      path.join(itemsDir, `${name}.json`),
      JSON.stringify(item, null, 2) + "\n"
    );

    index.push({
      name,
      description: meta.description,
      ...(meta.hidden ? { hidden: true } : {}),
      ...(projectRequirements.length > 0 ? { projectRequirements } : {}),
    });
    console.log(
      `  built ${name} (deps: ${dependencies.join(", ") || "none"})`
    );
  }

  const expectedItemFiles = new Set(dirs.map((name) => `${name}.json`));
  const orphanedItemFiles = (await fs.readdir(itemsDir)).filter(
    (file) => file.endsWith(".json") && !expectedItemFiles.has(file)
  );
  if (orphanedItemFiles.length > 0) {
    if (checkMode) {
      throw new Error(
        `Orphaned registry item file(s): ${orphanedItemFiles.join(", ")}`
      );
    }
    await Promise.all(
      orphanedItemFiles.map((file) => fs.rm(path.join(itemsDir, file)))
    );
  }

  await emitGeneratedFile(indexPath, JSON.stringify(index, null, 2) + "\n");

  console.log(
    `\n✓ ${dirs.length} tool(s) ${checkMode ? "verified" : "→ items/ + index.json"}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
