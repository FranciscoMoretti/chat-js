import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// These verify the maintained runtime, not downstream application customizations.
// Keep their sources and CI coverage in ChatJS, outside generated applications.
const MAINTAINER_FILES = new Set([
  "lib/db/migrations/eve-runtime-migration.test.ts",
  "lib/eve/tool-selection.test.ts",
  "tests/fixtures/eve-oauth-mcp-server.ts",
  "vitest.eve.config.ts",
]);

export const isMaintainerOnlyFile = (relativePath: string): boolean => {
  const file = relativePath.split(path.sep).join("/");
  return (
    MAINTAINER_FILES.has(file) ||
    file.startsWith("tests/eve-") ||
    (file.startsWith("playwright.eve") && file.endsWith(".config.ts"))
  );
};

export const normalizeScaffoldTestConfig = async (destination: string) => {
  const packagePath = path.join(destination, "package.json");
  const manifest = JSON.parse(await readFile(packagePath, "utf-8"));
  // Only the omitted migration regression uses the embedded database.
  delete manifest.devDependencies?.["@electric-sql/pglite"];
  await writeFile(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);

  const tsconfigPath = path.join(destination, "tsconfig.json");
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf-8"));
  delete tsconfig.compilerOptions.paths["@eve-test/*"];
  delete tsconfig.compilerOptions.paths["@world-postgres-test/*"];
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

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
