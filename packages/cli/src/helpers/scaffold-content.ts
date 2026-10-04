import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  researchAgentFiles,
  researchAgentDirectories,
} from "../../../registry/src/tools/research";
/* oxlint-enable import/no-relative-parent-imports */

const researchTestFiles = [
  "lib/eve/research-availability.test.ts",
  "lib/eve/research-tool.test.ts",
  "lib/eve/research-steps.test.ts",
  "lib/eve/research-search-updates.test.ts",
  "tests/native-research-runtime.ts",
];

// Runtime regressions, historical migration tools and sample evaluations stay
// in the reference repository rather than becoming downstream app source.
const REPOSITORY_ONLY_FILES = new Set([
  "app/(chat)/api/files/upload/route.test.ts",
  "app/api/mcp/oauth/callback/route.test.ts",
  ...researchAgentFiles,
  ...researchTestFiles,
  "scripts/db-branch-create.sh",
  "scripts/db-branch-delete.sh",
  "scripts/db-branch-use.sh",
  "scripts/with-db.sh",
  "components/model-toolbar-visual-fixture.tsx",
  "components/ui/layout-primitives-visual-fixture.tsx",
  "components/ui/ui-primitives-visual-fixture.tsx",
  "evalite.config.ts",
  "playwright.visual.config.ts",
  "playwright.guest.config.ts",
  "lib/ai/eval-agent.ts",
  "lib/db/eve-sandbox-run-coverage.test.ts",
  "lib/db/migrations/eve-runtime-migration.test.ts",
  "lib/db/eve-search.test.ts",
  "lib/db/eve-subagents.test.ts",
  "lib/eve/core-tool-types.test.ts",
  "lib/eve/document-execution.test.ts",
  "lib/eve/document-deletion.test.ts",
  "lib/eve/document-runs.test.ts",
  "lib/eve/saved-code-executor.test.ts",
  "lib/eve/local-sandbox-inventory.test.ts",
  "lib/eve/purge-local-sandbox.test.ts",
  "lib/eve/verify-local-coverage.test.ts",
  "lib/eve/tool-selection.test.ts",
  "lib/eve/mcp-setup.test.ts",
  "app/api/mcp/oauth/callback/route.test.ts",
  "lib/db/mcp-oauth-lock.test.ts",
  "tests/fixtures/eve-oauth-mcp-server.ts",
  "vitest.eve.config.ts",
]);

const isRepositoryOnlyFile = (relativePath: string): boolean => {
  const file = relativePath.split(path.sep).join("/");
  return (
    REPOSITORY_ONLY_FILES.has(file) ||
    (file.endsWith(".test.ts") &&
      (file.startsWith("lib/ai/mcp/") ||
        file.startsWith("lib/db/mcp-") ||
        file === "lib/eve/mcp-tools.test.ts" ||
        file === "lib/eve/mcp-adapter.test.ts" ||
        file === "lib/eve/mcp-registration.test.ts")) ||
    researchAgentDirectories.some(
      (directory): boolean =>
        file === directory || file.startsWith(`${directory}/`)
    ) ||
    file === "evals" ||
    file.startsWith("evals/") ||
    file.startsWith("tests/eve-") ||
    file === "tests/visual" ||
    file.startsWith("tests/visual/") ||
    file === "app/(chat)/visual-fixtures" ||
    file.startsWith("app/(chat)/visual-fixtures/") ||
    (file.startsWith("tests/") &&
      (file.endsWith(".visual.e2e.ts") ||
        file
          .split("/")
          .some((segment): boolean =>
            segment.endsWith(".visual.e2e.ts-snapshots")
          ))) ||
    (file.startsWith("playwright.eve") && file.endsWith(".config.ts"))
  );
};

const EXCLUDED_SEGMENTS = new Set([
  ".devtools",
  ".eve",
  ".output",
  ".vercel",
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

const shouldCopyAppFile = (relativePath: string): boolean => {
  const segments = relativePath.split(path.sep);
  return !segments.some(
    (segment): boolean =>
      EXCLUDED_SEGMENTS.has(segment) ||
      EXCLUDED_FILES.has(segment) ||
      segment.endsWith(".tsbuildinfo") ||
      (segment.startsWith(".env") && segment !== ".env.example")
  );
};

const shouldCopyChatAppFile = (relativePath: string): boolean =>
  shouldCopyAppFile(relativePath) && !isRepositoryOnlyFile(relativePath);

const shouldCopyElectronFile = (relativePath: string): boolean =>
  shouldCopyAppFile(relativePath) &&
  !relativePath
    .split(path.sep)
    .some((segment) => segment === "release" || segment === "branding.json");

// Remove the reference-app project while retaining the starter behavior suites.
const REFERENCE_VISUAL_PROJECT =
  /^ {4}\{\n {6}name: "visual",[\s\S]*?^ {4}\},\n/gmu;

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const normalizeScaffoldContent = async (destination: string): Promise<void> => {
  const packagePath = path.join(destination, "package.json");
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  const manifest = JSON.parse(await readFile(packagePath, "utf-8"));
  // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  for (const name of Object.keys(manifest.dependencies ?? {})) {
    if (
      (name.startsWith("@lexical/") && name !== "@lexical/react") ||
      name.startsWith("@codemirror/") ||
      [
        "codemirror",
        "diff",
        "papaparse",
        "react-data-grid",
        "echarts",
        "echarts-for-react",
      ].includes(name)
    ) {
      // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
      Reflect.deleteProperty(manifest.dependencies, name);
    }
  }
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  delete manifest.devDependencies?.["@types/papaparse"];
  for (const dependency of [
    "@electric-sql/pglite",
    "pg",
    "@types/pg",
    "evalite",
    "better-sqlite3",
  ]) {
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
    delete manifest.devDependencies?.[dependency];
  }
  for (const script of [
    "eval:dev",
    "eval:serve",
    "test:research:native",
    "test:tools:live",
  ]) {
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
    delete manifest.scripts?.[script];
  }
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  delete manifest.overrides?.evalite;
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  const tsconfigPath = path.join(destination, "tsconfig.json");
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf-8"));
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
  delete tsconfig.compilerOptions.paths["@eve-test/*"];
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Preserve the existing template manifest shape and unrelated user fields; stricter parsing here requires a migration policy for supported template variants.
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
  // The copied app config becomes the project root, where Oxlint permits typeAware.
  const standaloneLint = lint.includes("options: { typeAware: true }")
    ? lint
    : lint.replace(
        "  overrides: [",
        "  options: { typeAware: true },\n  overrides: ["
      );
  await writeFile(
    lintPath,
    standaloneLint.replace(
      '        "tests/eve-fixture/agent/tools/confirm_note.ts",\n',
      ""
    )
  );
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export {
  normalizeScaffoldContent,
  researchTestFiles,
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
};
