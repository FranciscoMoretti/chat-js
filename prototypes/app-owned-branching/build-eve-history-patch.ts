/** Rebuild this experiment's compiled overlay without replacing unrelated fork modules. */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import ts from "typescript";

const [sourceRoot, pristinePackage] = process.argv.slice(2);
if (!sourceRoot || !pristinePackage) {
  throw new Error(
    "Usage: bun build-eve-history-patch.ts <built-eve-source-root> <pristine-eve-0.52.2-package>"
  );
}
const repo = path.resolve(import.meta.dirname, "../..");
const scratch = mkdtempSync(
  path.join(tmpdir(), "chatjs-eve-history-artifact-")
);
const packagePath = path.join(scratch, "package");
const read = (file: string) => readFileSync(file, "utf-8");
const sourceDist = path.join(sourceRoot, "packages/eve/dist/src");
const declaration = (code: string, name: string) => {
  const parsed = ts.createSourceFile(
    "module.js",
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const found = parsed.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name
  );
  if (!found) {
    throw new Error(`Missing compiled function ${name}`);
  }
  return {
    end: found.end,
    start: found.getStart(parsed),
    text: found.getText(parsed),
  };
};
try {
  const original = JSON.parse(read(path.join(pristinePackage, "package.json")));
  if (original.version !== "0.52.2" || original.exports["./transcript"]) {
    throw new Error("Expected pristine published eve@0.52.2");
  }
  cpSync(pristinePackage, packagePath, { recursive: true });
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", packagePath, ...args], { encoding: "utf-8" });
  git("init", "--quiet");
  git("add", ".");
  git("apply", path.join(repo, "patches/eve@0.52.2.patch"));
  const manifestPath = path.join(packagePath, "package.json");
  const manifest = JSON.parse(read(manifestPath));
  const alias = "#eve-patched-dist-src-execution-session-history-seed.js";
  manifest.imports[alias] = {
    default: "./eve-patched-dist-src-execution-session-history-seed.js",
    types: "./eve-patched-dist-src-execution-session-history-seed.d.ts",
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const relocated = [
    "execution/session-history-seed",
    "execution/session-transcript-seed",
    "execution/read-session-transcript-prefix",
    "public/transcript",
  ];
  const rewrite = (code: string) => {
    let result = code;
    for (const name of relocated) {
      result = result.replaceAll(
        `#${name}.js`,
        `#eve-patched-dist-src-${name.replaceAll("/", "-")}.js`
      );
    }
    return result;
  };
  for (const name of relocated) {
    for (const extension of ["js", "d.ts"]) {
      const code = read(path.join(sourceDist, `${name}.${extension}`));
      writeFileSync(
        path.join(
          packagePath,
          `eve-patched-dist-src-${name.replaceAll("/", "-")}.${extension}`
        ),
        rewrite(code)
      );
    }
  }
  // The maintained source/dist trees already have unrelated differences. Replace
  // only these named functions, preserving every other installed implementation.
  for (const [file, names] of [
    ["harness/emission.js", ["emitTurnEpilogue"]],
    [
      "harness/tool-loop.js",
      ["emitStructuredResult", "finishTaskTurn", "finishConversationTurn"],
    ],
  ] satisfies [string, string[]][]) {
    const built = read(path.join(sourceDist, file));
    const target = path.join(packagePath, "dist/src", file);
    let installed = read(target);
    for (const name of names) {
      const old = declaration(installed, name);
      const replacement = declaration(built, name);
      installed =
        installed.slice(0, old.start) +
        replacement.text +
        installed.slice(old.end);
    }
    writeFileSync(target, installed);
  }
  const typesPath = path.join(
    packagePath,
    "dist/src/client/message-reducer-types.d.ts"
  );
  const types = read(typesPath);
  if (!types.includes('readonly outputType?: "text";')) {
    writeFileSync(
      typesPath,
      types.replace(
        "readonly output: unknown;",
        'readonly output: unknown;\n    /** Imported model tool output is text rather than JSON when specified. */\n    readonly outputType?: "text";'
      )
    );
  }
  const emissionTypes = path.join(
    packagePath,
    "dist/src/harness/emission.d.ts"
  );
  let installedTypes = read(emissionTypes);
  const builtTypes = read(path.join(sourceDist, "harness/emission.d.ts"));
  const signature = /export declare function emitTurnEpilogue[^;]+;/u;
  const freshSignature = builtTypes.match(signature)?.[0];
  if (!freshSignature || !signature.test(installedTypes)) {
    throw new Error("Missing emission declaration");
  }
  installedTypes = installedTypes.replace(signature, freshSignature);
  writeFileSync(emissionTypes, installedTypes);
  git("add", "-N", ".");
  git("diff", "--check");
  writeFileSync(
    path.join(repo, "patches/eve@0.52.2.patch"),
    git("diff", "--binary")
  );
} finally {
  rmSync(scratch, { force: true, recursive: true });
}
