import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Runtime regressions, historical migration tools and sample evaluations stay
// in the reference repository rather than becoming downstream app source.
const REPOSITORY_ONLY_FILES = new Set([
  "components/model-toolbar-visual-fixture.tsx",
  "components/ui/layout-primitives-visual-fixture.tsx",
  "components/ui/ui-primitives-visual-fixture.tsx",
  "evalite.config.ts",
  "playwright.visual.config.ts",
  "lib/ai/eval-agent.ts",
  "lib/db/backfill-parts.ts",
  "lib/db/eve-sandbox-run-coverage.test.ts",
  "lib/db/migrations/eve-runtime-migration.test.ts",
  "lib/eve/local-sandbox-inventory.test.ts",
  "lib/eve/purge-local-sandbox.test.ts",
  "lib/eve/verify-local-coverage.test.ts",
  "lib/eve/tool-selection.test.ts",
  "tests/fixtures/eve-oauth-mcp-server.ts",
  "vitest.eve.config.ts",
]);

const isRepositoryOnlyFile = (relativePath: string): boolean => {
  const file = relativePath.split(path.sep).join("/");
  return (
    REPOSITORY_ONLY_FILES.has(file) ||
    file === "evals" ||
    file.startsWith("evals/") ||
    file.startsWith("tests/eve-") ||
    file === "app/(chat)/visual-fixtures" ||
    file.startsWith("app/(chat)/visual-fixtures/") ||
    (file.startsWith("tests/") &&
      (file.endsWith(".visual.e2e.ts") ||
        file
          .split("/")
          .some((segment) => segment.endsWith(".visual.e2e.ts-snapshots")))) ||
    (file.startsWith("playwright.eve") && file.endsWith(".config.ts"))
  );
};

const EXCLUDED_SEGMENTS = new Set([
  ".devtools",
  ".eve",
  ".output",
  "eve-results",
  "node_modules",
  ".next",
  ".turbo",
  "playwright",
  "playwright-report",
  "test-results",
  "blob-report",
  "dist",
  "build",
]);
const EXCLUDED_FILES = new Set([".DS_Store", "bun.lock", "bun.lockb"]);

export const shouldCopyChatAppFile = (relativePath: string): boolean => {
  const segments = relativePath.split(path.sep);
  return !(
    isRepositoryOnlyFile(relativePath) ||
    segments.some(
      (segment) =>
        EXCLUDED_SEGMENTS.has(segment) ||
        EXCLUDED_FILES.has(segment) ||
        segment.endsWith(".tsbuildinfo") ||
        (segment.startsWith(".env") && segment !== ".env.example")
    )
  );
};

// Remove the reference-app project while retaining the starter behavior suites.
const REFERENCE_VISUAL_PROJECT =
  /^ {4}\{\n {6}name: "visual",[\s\S]*?^ {4}\},\n/gmu;

export const normalizeScaffoldContent = async (destination: string) => {
  const packagePath = path.join(destination, "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf-8"));
  for (const dependency of [
    "@electric-sql/pglite",
    "pg",
    "@types/pg",
    "evalite",
    "better-sqlite3",
  ]) {
    delete manifest.devDependencies?.[dependency];
  }
  for (const script of ["eval:dev", "eval:serve", "db:backfill-parts"]) {
    delete manifest.scripts?.[script];
  }
  delete manifest.overrides?.evalite;
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  const tsconfigPath = path.join(destination, "tsconfig.json");
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf-8"));
  delete tsconfig.compilerOptions.paths["@eve-test/*"];
  delete tsconfig.compilerOptions.paths["@world-postgres-test/*"];
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

  const playwrightPath = path.join(destination, "playwright.config.ts");
  const playwright = await readFile(playwrightPath, "utf-8");
  await writeFile(
    playwrightPath,
    playwright.replace(REFERENCE_VISUAL_PROJECT, "")
  );

  const lintPath = path.join(destination, "oxlint.config.ts");
  const lint = await readFile(lintPath, "utf-8");
  await writeFile(
    lintPath,
    lint.replace(
      '        "tests/eve-fixture/agent/tools/confirm_note.ts",\n',
      ""
    )
  );
};
