/** Build the fork overlay without replacing eve's published vendor bundles. */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const [sourceArgument, publishedArgument] = process.argv.slice(2);
if (!(sourceArgument && publishedArgument)) {
  throw new Error(
    "Usage: bun scripts/build-eve-patch.ts <eve-source> <pristine-package>"
  );
}
const source = path.resolve(sourceArgument);
const published = path.resolve(publishedArgument);
const root = path.resolve(import.meta.dir, "..");
const scratch = mkdtempSync(path.join(tmpdir(), "chatjs-eve-overlay-"));
const read = (file: string) => readFileSync(file, "utf-8");
const git = (directory: string, args: string[], index?: string) =>
  execFileSync("git", ["-C", directory, ...args], {
    encoding: "utf-8",
    env: index ? { ...process.env, GIT_INDEX_FILE: index } : process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
const manifest = JSON.parse(read(path.join(published, "package.json")));
if (manifest.version !== "0.61.0" || manifest.exports["./transcript"]) {
  throw new Error("Expected a pristine published eve@0.61.0 package.");
}
if (
  git(source, ["rev-parse", "HEAD"]).trim() !==
  git(source, ["rev-parse", "eve@0.61.0^{commit}"]).trim()
) {
  throw new Error("Expected source based on the eve@0.61.0 tag.");
}
try {
  const changed = new Set([
    ...git(source, ["diff", "--name-only", "HEAD"]).trim().split("\n"),
    ...git(source, ["ls-files", "--others", "--exclude-standard"])
      .trim()
      .split("\n"),
  ]);
  const files = [...changed]
    .filter(
      (file) =>
        ["packages/eve/src/", "docs/", "research/", ".changeset/", "e2e/"].some(
          (prefix) => file.startsWith(prefix)
        ) || file === "packages/eve/package.json"
    )
    .toSorted();
  const index = path.join(scratch, "source-index");
  git(source, ["read-tree", "HEAD"], index);
  git(source, ["add", "-A", "--", ...files], index);
  writeFileSync(
    path.join(root, "patches/eve-0.61.0.source.patch"),
    git(source, ["diff", "--cached", "--binary", "HEAD"], index)
  );
  const destination = path.join(scratch, "package");
  cpSync(published, destination, { recursive: true });
  git(destination, ["init", "--quiet"]);
  git(destination, ["add", "."]);
  const modules = files
    .filter(
      (file) =>
        file.startsWith("packages/eve/src/") &&
        file.endsWith(".ts") &&
        !file.endsWith(".test.ts") &&
        !file.includes("/internal/testing/") &&
        existsSync(path.join(source, file))
    )
    .map((file) => file.slice("packages/eve/src/".length, -3));
  const aliases = new Map(
    modules
      .filter(
        (name) => !existsSync(path.join(published, `dist/src/${name}.js`))
      )
      .map((name) => [
        name,
        `eve-patched-dist-src-${name.replaceAll("/", "-")}`,
      ])
  );
  for (const name of modules) {
    for (const extension of ["js", "d.ts"]) {
      let code = read(
        path.join(source, `packages/eve/dist/src/${name}.${extension}`)
      );
      for (const [original, alias] of aliases) {
        code = code.replaceAll(`#${original}.js`, `#${alias}.js`);
      }
      const target = path.join(
        destination,
        `${aliases.get(name) ?? `dist/src/${name}`}.${extension}`
      );
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, code);
    }
  }
  manifest.exports = JSON.parse(
    read(path.join(source, "packages/eve/package.json"))
  ).exports;
  for (const [name, alias] of aliases) {
    manifest.imports[`#${alias}.js`] = {
      default: `./${alias}.js`,
      types: `./${alias}.d.ts`,
    };
    for (const entry of Object.values<Record<string, string>>(
      manifest.exports
    )) {
      if (typeof entry !== "object") {
        continue;
      }
      for (const [condition, value] of Object.entries(entry)) {
        if (value.startsWith(`./dist/src/${name}.`)) {
          entry[condition] = value.replace(`./dist/src/${name}`, `./${alias}`);
        }
      }
    }
  }
  writeFileSync(
    path.join(destination, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  git(destination, ["add", "-N", "."]);
  writeFileSync(
    path.join(root, "patches/eve@0.61.0.patch"),
    git(destination, ["diff", "--binary"])
  );
} finally {
  rmSync(scratch, { force: true, recursive: true });
}
