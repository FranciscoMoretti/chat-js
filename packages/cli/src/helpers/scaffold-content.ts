// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  researchAgentDirectories,
  researchAgentFiles,
} from "../../../registry/src/tools/research";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
import { isJsonObject } from "./json-object";

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
  "vitest.eve-provider.config.ts",
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

interface ScaffoldPackageManifest {
  dependencies?: Record<string, unknown> | null;
  devDependencies?: Record<string, unknown> | null;
  overrides?: Record<string, unknown> | null;
  scripts?: Record<string, unknown> | null;
}

interface ScaffoldTsConfig {
  compilerOptions: { paths: Record<string, unknown> };
}

const isScaffoldPackageManifest = (
  value: unknown
): value is ScaffoldPackageManifest =>
  isJsonObject(value) &&
  ["dependencies", "devDependencies", "overrides", "scripts"].every(
    (key) =>
      !Object.hasOwn(value, key) ||
      value[key] === null ||
      isJsonObject(value[key])
  );

const parseScaffoldPackageManifest = (
  source: string
): ScaffoldPackageManifest => {
  const value: unknown = JSON.parse(source);
  if (!isScaffoldPackageManifest(value)) {
    throw new TypeError(
      "Template package.json must be an object with object-valued dependency, override, and script maps."
    );
  }
  // Return the original JSON data object: unknown extension fields and key order
  // survive normalization, and optional null maps keep their existing sentinel.
  return value;
};

const isScaffoldTsConfig = (value: unknown): value is ScaffoldTsConfig =>
  isJsonObject(value) &&
  isJsonObject(value.compilerOptions) &&
  isJsonObject(value.compilerOptions.paths);

const parseScaffoldTsConfig = (source: string): ScaffoldTsConfig => {
  const value: unknown = JSON.parse(source);
  if (!isScaffoldTsConfig(value)) {
    throw new TypeError(
      "Template tsconfig.json must declare an object-valued compilerOptions.paths map."
    );
  }
  return value;
};

const JSON_INDENTATION_SPACES = 2;

const formattedScaffoldJson = (value: unknown): string =>
  // oxlint-disable-next-line unicorn/no-null -- A null JSON.stringify replacer preserves unknown template fields; the third argument keeps existing deterministic two-space formatting.
  `${JSON.stringify(value, null, JSON_INDENTATION_SPACES)}\n`;

const isRepositoryOnlyDependency = (name: string): boolean =>
  (name.startsWith("@lexical/") && name !== "@lexical/react") ||
  name.startsWith("@codemirror/") ||
  [
    "codemirror",
    "diff",
    "papaparse",
    "react-data-grid",
    "echarts",
    "echarts-for-react",
  ].includes(name);

const normalizePackageManifest = async (packagePath: string): Promise<void> => {
  const manifest = parseScaffoldPackageManifest(
    await readFile(packagePath, "utf-8")
  );
  const dependencies = manifest.dependencies ?? {};
  for (const name of Object.keys(dependencies).filter((dependencyName) =>
    isRepositoryOnlyDependency(dependencyName)
  )) {
    Reflect.deleteProperty(dependencies, name);
  }
  for (const dependency of [
    "@types/papaparse",
    "@electric-sql/pglite",
    "pg",
    "@types/pg",
    "evalite",
    "better-sqlite3",
  ]) {
    delete manifest.devDependencies?.[dependency];
  }
  for (const script of [
    "eval:dev",
    "eval:serve",
    "test:native",
    "test:research:native",
    "test:tools:live",
  ]) {
    delete manifest.scripts?.[script];
  }
  delete manifest.overrides?.evalite;
  await writeFile(packagePath, formattedScaffoldJson(manifest));
};

const normalizeTsConfig = async (tsconfigPath: string): Promise<void> => {
  const tsconfig = parseScaffoldTsConfig(await readFile(tsconfigPath, "utf-8"));
  delete tsconfig.compilerOptions.paths["@eve-test/*"];
  delete tsconfig.compilerOptions.paths["@world-postgres-test/*"];
  await writeFile(tsconfigPath, formattedScaffoldJson(tsconfig));
};

const removeReferenceVisualProject = async (
  destination: string
): Promise<void> => {
  const playwrightPath = path.join(destination, "playwright.config.ts");
  const playwright = await readFile(playwrightPath, "utf-8");
  await writeFile(
    playwrightPath,
    playwright.replace(REFERENCE_VISUAL_PROJECT, "")
  );
};

const normalizeStandaloneLintConfig = async (
  destination: string
): Promise<void> => {
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

const normalizeScaffoldContent = async (destination: string): Promise<void> => {
  await normalizePackageManifest(path.join(destination, "package.json"));
  await normalizeTsConfig(path.join(destination, "tsconfig.json"));
  await removeReferenceVisualProject(destination);
  await normalizeStandaloneLintConfig(destination);
};
export {
  normalizeScaffoldContent,
  researchTestFiles,
  shouldCopyChatAppFile,
  shouldCopyElectronFile,
};
