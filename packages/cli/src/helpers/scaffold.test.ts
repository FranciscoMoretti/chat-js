import { afterEach, describe, expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture inspects project files using native filesystem APIs.
import { existsSync, readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import {
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves installed packages from their declaring workspace using native module resolution.
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import pathModule from "node:path";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun test evaluates generated Node configuration with controlled native runtime bindings.
import { runInNewContext } from "node:vm";

import ts from "typescript";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { buildConfigTs } from "./config-builder";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "./scaffold";
/* oxlint-enable sort-imports */

const tempDirs: string[] = [];
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
const originalUserAgent = process.env.npm_config_user_agent;
/* oxlint-enable node/no-process-env */

const makeTempDir = (name: string): string => {
  const dir = pathModule.join(
    tmpdir(),
    `chat-js-cli-${name}-${crypto.randomUUID()}`
  );
  tempDirs.push(dir);
  return dir;
};

const getCliPackageRoot = (): string =>
  pathModule.resolve(import.meta.dirname, "../..");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async (): Promise<void> => {
  if (originalUserAgent === undefined) {
    delete process.env.npm_config_user_agent;
  } else {
    process.env.npm_config_user_agent = originalUserAgent;
  }
  await Promise.all(
    tempDirs
      .splice(0)
      .map((dir): Promise<void> => rm(dir, { force: true, recursive: true }))
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
describe("buildConfigTs", (): void => {
  it("writes desktopApp.enabled=false for web-only scaffolds", (): void => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      gateway: "vercel",
      withElectron: false,
    });

    expect(output).toMatch(
      /desktopApp:\s*\{(?:\s*\/\/[^\n]*\n)*\s*enabled:\s*false,/mu
    );
    expect(output).toContain("parallelResponses: true");
    expect(output).not.toContain("documents: {");
    expect(output).not.toContain("codeExecution: {");
    expect(output).not.toContain("attachments: false");
  });
  it("writes desktopApp.enabled=true for Electron scaffolds", (): void => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      gateway: "vercel",
      withElectron: true,
    });

    expect(output).toMatch(
      /desktopApp:\s*\{(?:\s*\/\/[^\n]*\n)*\s*enabled:\s*true,/mu
    );
    expect(output).toContain("parallelResponses: true");
    expect(output).not.toContain("documents: {");
    expect(output).toContain("video: {");
  });
  it("preserves gateway media defaults for openai-compatible scaffolds", (): void => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      gateway: "openai-compatible",
      withElectron: false,
    });

    expect(output).toContain('gateway: "openai-compatible"');
    expect(output).toContain("image: {");
    expect(output).toContain('default: "gpt-image-1"');
    expect(output).not.toMatch(/video:\s*\{[^}]*enabled:/mu);
  });
});
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
describe("scaffoldFromTemplate", (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("ships remaining patches as archives and preserves the eve package dependency", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-patched-runtimes");
    await scaffoldFromTemplate(destination);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies.eve).toBe("npm:@chat-js/eve@0.61.0-chatjs.0");
    const archives = {
      "@workflow/world-postgres": "workflow-world-postgres-5.0.0-beta.40.tgz",
    };

    for (const [packageName, archiveName] of Object.entries(archives)) {
      expect(manifest.dependencies[packageName]).toBe(
        `file:vendor/${archiveName}`
      );
      expect(
        // oxlint-disable-next-line eslint/no-await-in-loop -- Check each generated archive against the same staged scaffold.
        await Bun.file(
          pathModule.join(destination, "vendor", archiveName)
        ).exists()
      ).toBe(true);
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("omits maintainer harnesses while preserving application source and starter tests", async (): Promise<void> => {
    const destination = makeTempDir("maintainer-boundary");
    await scaffoldFromTemplate(destination);
    for (const file of [
      "tests/ui-primitives.visual.e2e.ts",
      "tests/layout-primitives.visual.e2e.ts",
      "tests/model-toolbar.visual.e2e.ts",
      "tests/mcp-connectors.visual.e2e.ts",
      "tests/ui-primitives.visual.e2e.ts-snapshots",
      "tests/layout-primitives.visual.e2e.ts-snapshots",
      "tests/model-toolbar.visual.e2e.ts-snapshots",
      "app/(chat)/visual-fixtures",
      "components/model-toolbar-visual-fixture.tsx",
      "components/ui/layout-primitives-visual-fixture.tsx",
      "components/ui/ui-primitives-visual-fixture.tsx",
      "playwright.visual.config.ts",
      "tests/eve-browser.e2e.ts",
      "tests/eve-message-presentation.fixture.tsx",
      "tests/fixtures/eve-oauth-mcp-server.ts",
      "lib/eve/tool-selection.test.ts",
      "lib/eve/local-sandbox-inventory.test.ts",
      "lib/eve/purge-local-sandbox.test.ts",
      "lib/eve/verify-local-coverage.test.ts",
      "lib/db/eve-sandbox-run-coverage.test.ts",
      "evals/my-eval.eval.ts",
      "lib/ai/eval-agent.ts",
      "evalite.config.ts",
      "tsconfig.tsbuildinfo",
      "lib/db/migrations/eve-runtime-migration.test.ts",
      "lib/db/eve-search.test.ts",
      "playwright.eve.config.ts",
      "playwright.guest.config.ts",
      "vitest.eve.config.ts",
      "vitest.eve-provider.config.ts",
    ]) {
      expect(existsSync(pathModule.join(destination, file))).toBe(false);
    }
    for (const file of [
      "tests/chat.e2e.ts",
      "tests/reasoning.e2e.ts",
      "tests/artifacts.e2e.ts",
      "components/eve/eve-conversation.tsx",
      "lib/eve/message-delivery.test.ts",
      "lib/db/migrations/0000_eve_baseline.sql",
      "scripts/eve-setup.ts",
      "scripts/eve-setup-config.ts",
      "lib/eve/world-config.ts",
      "vitest.config.ts",
    ]) {
      expect(existsSync(pathModule.join(destination, file))).toBe(true);
    }
    const playwright = await readFile(
      pathModule.join(destination, "playwright.config.ts"),
      "utf-8"
    );
    expect(playwright).not.toContain('name: "visual"');
    expect(playwright).toContain('name: "chat"');
    expect(playwright).toContain('name: "reasoning"');
    expect(playwright).toContain('name: "artifacts"');
    const tsconfig = await readFile(
      pathModule.join(destination, "tsconfig.json"),
      "utf-8"
    );
    expect(tsconfig).not.toContain("@eve-test");
    expect(tsconfig).not.toContain("@world-postgres-test");
    const lint = await readFile(
      pathModule.join(destination, "oxlint.config.ts"),
      "utf-8"
    );
    expect(lint).not.toContain("tests/eve-fixture");
    expect(lint.match(/options: \{ typeAware: true \}/gu)).toHaveLength(1);
    const lintManifest: unknown = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    expect(lintManifest).toMatchObject({
      devDependencies: { "oxlint-tsgolint": "7.0.2001" },
      scripts: {
        lint: "next typegen . && ultracite check",
      },
    });
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    for (const dependency of [
      "@electric-sql/pglite",
      "pg",
      "@types/pg",
      "evalite",
      "better-sqlite3",
    ]) {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.devDependencies[dependency]).toBeUndefined();
    }
    // oxlint-disable-next-line typescript/no-unsafe-member-access, oxc/no-optional-chaining -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary. Optional chain: Keep the existing nullish guard when reading evalite from manifest.overrides; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(manifest.overrides?.evalite).toBeUndefined();
    for (const script of [
      "eval:dev",
      "eval:serve",
      "test:native",
      "test:research:native",
      "test:tools:live",
    ]) {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.scripts[script]).toBeUndefined();
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("leaves the storage slot and provider peers to registry installation", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-storage");
    await scaffoldFromTemplate(destination);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(manifest.dependencies["files-sdk"]).toBe("2.5.0");
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeUndefined();
    expect(
      await Bun.file(
        pathModule.join(destination, "lib/storage-provider.ts")
      ).exists()
    ).toBe(false);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("writes a standalone-safe root package.json", async (): Promise<void> => {
    const destination = makeTempDir("chat-app");

    await scaffoldFromTemplate(destination);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
      dependencies: Record<string, string>;
      overrides?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.packageManager).toBe(`bun@${Bun.version}`);
    expect(packageJson.dependencies["@better-auth/core"]).toBe("1.6.2");
    expect(packageJson.dependencies["@better-auth/electron"]).toBe("1.6.2");
    expect(packageJson.dependencies["better-auth"]).toBe("1.6.2");
    expect(packageJson.dependencies["@chat-js/thread"]).toBeUndefined();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading "@better-auth/core" from packageJson.overrides; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.6.2");
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading build from packageJson.scripts; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.scripts?.build).toBe(
      "tsx lib/db/migrate.ts --deployment && eve build && next build"
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading prebuild from packageJson.scripts; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.scripts?.prebuild).not.toContain("@chat-js/thread");
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading "redis:connect" from packageJson.scripts; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.scripts?.["redis:connect"]).toBeUndefined();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading format from packageJson.scripts; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.scripts?.format).toBe("oxfmt --write .");
    expect(existsSync(pathModule.join(destination, "biome.jsonc"))).toBe(false);
    expect(existsSync(pathModule.join(destination, "oxlint.config.ts"))).toBe(
      true
    );
    expect(existsSync(pathModule.join(destination, "oxfmt.config.ts"))).toBe(
      true
    );
    expect(
      existsSync(pathModule.join(destination, "oxlint-baseline.json"))
    ).toBe(false);

    for (const path of [
      "app/(chat)/api/chat",
      "app/(chat)/chat-providers.tsx",
      "app/(chat)/chat-route-host.tsx",
      "app/(chat)/chat-runtime-boundary.tsx",
      "components/chat-runtime-controller.tsx",
      "components/chat-header.tsx",
      "components/chat-sync.tsx",
      "components/chat-system.tsx",
      "lib/app-chat-runtime.ts",
      "lib/application-thread.ts",
      "lib/chat-runtime-id.ts",
      "lib/runtime-registry",
      "lib/stores",
      "lib/thread",
      "providers/chat-input-provider.tsx",
    ]) {
      expect(existsSync(pathModule.join(destination, path))).toBe(false);
    }

    expect(
      existsSync(
        pathModule.join(destination, "components/chat-header-view.tsx")
      )
    ).toBe(true);
    expect(
      existsSync(
        pathModule.join(destination, "components/chat/chat-layout.tsx")
      )
    ).toBe(true);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("rewrites the generated web app to be npm-friendly", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-npm");

    await scaffoldFromTemplate(destination, { packageManager: "npm" });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
      scripts: Record<string, string>;
    };

    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+/u);
    for (const script of Object.values(packageJson.scripts)) {
      expect(script).not.toContain("bun ");
      expect(script).not.toContain("bunx");
    }

    expect(
      await readFile(
        pathModule.join(destination, "playwright.config.ts"),
        "utf-8"
      )
    ).toContain('command: "npm run dev"');
    expect(
      await readFile(
        pathModule.join(destination, "scripts", "check-env.ts"),
        "utf-8"
      )
    ).toContain("npm run fetch:models");
    expect(
      await readFile(
        pathModule.join(
          destination,
          "lib",
          "ai",
          "gateways",
          "fallback-models.ts"
        ),
        "utf-8"
      )
    ).toContain("npm run fetch:models");
    const neonFiles = [
      "db-branch-create.sh",
      "db-branch-delete.sh",
      "db-branch-use.sh",
      "with-db.sh",
    ];
    expect(
      await Promise.all(
        neonFiles.map((file): Promise<boolean> =>
          Bun.file(pathModule.join(destination, "scripts", file)).exists()
        )
      )
    ).toEqual(neonFiles.map((): boolean => false));
    expect(
      Object.keys(packageJson.scripts).filter(
        (name): boolean =>
          name.startsWith("db:branch:") ||
          name === "dev:neon" ||
          name === "db:migrate:neon"
      )
    ).toEqual([]);
    expect(packageJson.scripts["db:migrate"]).toBe("tsx lib/db/migrate.ts");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("allows known native package build scripts for pnpm scaffolds", async (): Promise<void> => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const destination = makeTempDir("chat-app-pnpm");

    await scaffoldFromTemplate(destination, { packageManager: "pnpm" });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
    };
    const workspaceConfig = await readFile(
      pathModule.join(destination, "pnpm-workspace.yaml"),
      "utf-8"
    );

    expect(packageJson.packageManager).toBe("pnpm@10.33.1");
    expect(workspaceConfig).toContain("onlyBuiltDependencies:");
    expect(workspaceConfig).toContain("allowBuilds:");
    expect(workspaceConfig).not.toContain("better-sqlite3");
    expect(workspaceConfig).toContain("cbor-extract: true");
    expect(workspaceConfig).toContain("electron: true");
    expect(workspaceConfig).toContain("electron-winstaller: true");
    expect(workspaceConfig).toContain("esbuild: true");
    expect(workspaceConfig).toContain("fs-xattr: true");
    expect(workspaceConfig).toContain("macos-alias: true");
    expect(workspaceConfig).toContain("sharp: true");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("starts generated apps with an empty installable tool registry", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-tools");

    await scaffoldFromTemplate(destination);

    expect(
      existsSync(pathModule.join(destination, "agent/tools/deepResearch.ts"))
    ).toBe(false);
    for (const name of [
      "researchPlanner",
      "researcher",
      "researchCompressor",
      "researchWriter",
    ]) {
      expect(
        existsSync(pathModule.join(destination, "agent/subagents", name))
      ).toBe(false);
    }
    expect(
      existsSync(pathModule.join(destination, "tools", "chatjs", "get-weather"))
    ).toBe(false);
    expect(
      await readFile(
        pathModule.join(destination, "tools", "chatjs", "tools.ts"),
        "utf-8"
      )
    ).not.toContain("getWeather");
    expect(
      await readFile(
        pathModule.join(destination, "tools", "chatjs", "ui.ts"),
        "utf-8"
      )
    ).not.toContain("GetWeatherRenderer");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("falls back to repo source apps when synced templates are missing", async (): Promise<void> => {
    const projectDir = makeTempDir("chat-app-fallback");
    const templatesDir = pathModule.join(getCliPackageRoot(), "templates");
    const backupDir = pathModule.join(
      tmpdir(),
      `chat-js-cli-templates-${crypto.randomUUID()}`
    );

    if (existsSync(templatesDir)) {
      await rename(templatesDir, backupDir);
    }

    try {
      await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
      await scaffoldElectron(projectDir, {
        packageManager: "npm",
        projectName: "my-chat-app",
      });
      const electronTsconfig = await readFile(
        pathModule.join(projectDir, "electron", "tsconfig.json"),
        "utf-8"
      );
      expect(electronTsconfig).toContain('"../next-env.d.ts"');
      expect(electronTsconfig).toContain('"../electron.d.ts"');
      expect(electronTsconfig).not.toContain("../chat/");
      expect(existsSync(pathModule.join(projectDir, "electron.d.ts"))).toBe(
        true
      );
      const lintConfig = await readFile(
        pathModule.join(projectDir, "oxlint.config.ts"),
        "utf-8"
      );
      expect(lintConfig.match(/options: \{ typeAware: true \}/gu)).toHaveLength(
        1
      );
      const lintManifest: unknown = JSON.parse(
        await readFile(pathModule.join(projectDir, "package.json"), "utf-8")
      );
      expect(lintManifest).toMatchObject({
        devDependencies: { "oxlint-tsgolint": "7.0.2001" },
        scripts: {
          lint: "next typegen . && ultracite check",
        },
      });

      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      const packageJson = JSON.parse(
        await readFile(pathModule.join(projectDir, "package.json"), "utf-8")
      ) as {
        dependencies: Record<string, string>;
      };
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      const electronPackageJson = JSON.parse(
        await readFile(
          pathModule.join(projectDir, "electron", "package.json"),
          "utf-8"
        )
      ) as {
        devDependencies: Record<string, string>;
      };

      expect(
        existsSync(pathModule.join(projectDir, "tests/eve-browser.e2e.ts"))
      ).toBe(false);
      expect(
        existsSync(
          pathModule.join(
            projectDir,
            "lib/db/migrations/eve-runtime-migration.test.ts"
          )
        )
      ).toBe(false);
      expect(packageJson.dependencies["@better-auth/core"]).toBe("1.6.2");
      expect(packageJson.dependencies.eve).toBe(
        "npm:@chat-js/eve@0.61.0-chatjs.0"
      );
      expect(packageJson.dependencies["@ai-sdk/mcp"]).toBe("2.0.53");
      expect(packageJson.dependencies["@workflow/world-postgres"]).toBe(
        "file:vendor/workflow-world-postgres-5.0.0-beta.40.tgz"
      );
      expect(electronPackageJson.devDependencies["@better-auth/electron"]).toBe(
        "1.6.2"
      );
    } finally {
      if (existsSync(backupDir)) {
        await rename(backupDir, templatesDir);
      }
    }
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
describe("scaffoldFromGit", (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("leaves repositories without the ChatJS storage seam untouched", async (): Promise<void> => {
    const source = makeTempDir("plain-git-source");
    const destination = makeTempDir("plain-git-destination");
    await mkdir(source, { recursive: true });
    await writeFile(
      pathModule.join(source, "package.json"),
      JSON.stringify({ dependencies: {}, name: "plain-template" })
    );
    for (const args of [
      ["init"],
      ["add", "package.json"],
      [
        "-c",
        "user.name=ChatJS Test",
        "-c",
        "user.email=test@chatjs.dev",
        "commit",
        "-m",
        "initial",
      ],
    ]) {
      const result = Bun.spawnSync(["git", ...args], { cwd: source });
      expect(result.exitCode).toBe(0);
    }

    await scaffoldFromGit(source, destination);

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies).toEqual({});
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
describe("scaffoldElectron", (): void => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("runs generated Electron prebuild under Node and tsx", async (): Promise<void> => {
    const projectDir = makeTempDir("electron-node-prebuild");
    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });
    const electronDir = pathModule.join(projectDir, "electron");
    const nodeModules = pathModule.join(electronDir, "node_modules");
    const resolveDependency = createRequire(import.meta.url).resolve;
    await mkdir(pathModule.join(nodeModules, ".bin"), { recursive: true });
    await Promise.all([
      symlink(
        resolveDependency("tsx/cli"),
        pathModule.join(nodeModules, ".bin/tsx")
      ),
      symlink(
        pathModule.dirname(resolveDependency("png2icons/package.json")),
        pathModule.join(nodeModules, "png2icons"),
        "dir"
      ),
    ]);
    // Isolate app configuration so prebuild needs no environment credentials.
    await writeFile(
      pathModule.join(projectDir, "lib/config.ts"),
      `export const config = {
        appName: "Node Prebuild",
        appPrefix: "node-prebuild",
        appUrl: "http://localhost:3000",
        organization: { name: "Test", contact: { privacyEmail: "test@example.com" } },
      };`
    );
    const result = Bun.spawnSync(["npm", "run", "prebuild"], {
      cwd: electronDir,
      stderr: "pipe",
      stdout: "pipe",
    });
    expect({
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
    }).toEqual({ exitCode: 0, stderr: "" });
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const branding = JSON.parse(
      await readFile(pathModule.join(electronDir, "branding.json"), "utf-8")
    );
    expect(branding).toEqual({
      appName: "Node Prebuild",
      appPrefix: "node-prebuild",
      appUrl: "http://localhost:3000",
      orgEmail: "test@example.com",
      orgName: "Test",
    });
    const icons = await Promise.all(
      ["png", "icns", "ico"].map((extension) =>
        readFile(pathModule.join(electronDir, "build", `icon.${extension}`))
      )
    );
    for (const icon of icons) {
      expect(icon.length).toBeGreaterThan(0);
    }
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("runs generated Forge prebuild and build hooks with the selected package manager", async (): Promise<void> => {
    const projectDir = makeTempDir("electron-forge");
    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });
    const electronDir = pathModule.join(projectDir, "electron");
    await writeFile(
      pathModule.join(electronDir, "branding.json"),
      JSON.stringify({
        appName: "My Chat App",
        appPrefix: "my-chat-app",
        appUrl: "http://localhost:3000",
      })
    );
    const source = await readFile(
      pathModule.join(electronDir, "forge.config.ts"),
      "utf-8"
    );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const commands: {
      args: readonly string[];
      command: string;
      nodeEnv?: string;
    }[] = [];
    const configModule: {
      default?: { hooks: Record<string, () => Promise<void>> };
    } = {};
    runInNewContext(outputText, {
      __dirname: electronDir,
      exports: configModule,
      process: { env: {} },
      require: (id: string) => {
        if (id === "node:child_process") {
          return {
            spawnSync: (
              command: string,
              args: readonly string[],
              options: { readonly env: Readonly<NodeJS.ProcessEnv> }
            ) => {
              commands.push({ args, command, nodeEnv: options.env.NODE_ENV });
              return { status: 0 };
            },
          };
        }
        if (id === "node:fs") {
          return { existsSync, readFileSync };
        }
        if (id === "node:path") {
          return pathModule;
        }
        if (id.startsWith("@electron-forge/maker-")) {
          return {
            MakerDMG: Object,
            MakerDeb: Object,
            MakerRpm: Object,
            MakerSquirrel: Object,
            MakerZIP: Object,
          };
        }
        throw new Error(`Unexpected Forge dependency: ${id}`);
      },
    });
    expect(configModule.default).toBeDefined();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling configModule.default.hooks.generateAssets; read hooks from configModule.default; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    await configModule.default?.hooks.generateAssets?.();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling configModule.default.hooks.preStart; read hooks from configModule.default; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    await configModule.default?.hooks.preStart?.();
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling configModule.default.hooks.prePackage; read hooks from configModule.default; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result.
    await configModule.default?.hooks.prePackage?.();
    expect(commands).toEqual([
      { args: ["run", "prebuild"], command: "npm", nodeEnv: undefined },
      { args: ["run", "build"], command: "npm", nodeEnv: "development" },
      { args: ["run", "build"], command: "npm", nodeEnv: "production" },
    ]);
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("pins Better Auth versions in the generated electron app", async (): Promise<void> => {
    const projectDir = makeTempDir("electron");

    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(
        pathModule.join(projectDir, "electron", "package.json"),
        "utf-8"
      )
    ) as {
      packageManager?: string;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
      overrides?: Record<string, string>;
      pnpm?: unknown;
    };

    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+/u);
    expect(packageJson.pnpm).toBeUndefined();
    expect(packageJson.devDependencies["@better-auth/electron"]).toBe("1.6.2");
    expect(packageJson.devDependencies["better-auth"]).toBe("1.6.2");
    expect(packageJson.devDependencies.esbuild).toBeDefined();
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const rootPackageJson = JSON.parse(
      await readFile(pathModule.join(projectDir, "package.json"), "utf-8")
    ) as {
      devDependencies: Record<string, string>;
    };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const rootTsconfig = JSON.parse(
      await readFile(pathModule.join(projectDir, "tsconfig.json"), "utf-8")
    ) as {
      exclude?: string[];
    };
    const electronTsconfig = await readFile(
      pathModule.join(projectDir, "electron", "tsconfig.json"),
      "utf-8"
    );
    expect(electronTsconfig).toContain('"../next-env.d.ts"');
    expect(electronTsconfig).toContain('"../electron.d.ts"');
    expect(electronTsconfig).not.toContain("../chat/");
    expect(existsSync(pathModule.join(projectDir, "electron.d.ts"))).toBe(true);

    expect(packageJson.devDependencies.tsx).toBe(
      rootPackageJson.devDependencies.tsx
    );
    expect(rootTsconfig.exclude).toContain("electron");
    for (const script of Object.values(packageJson.scripts)) {
      expect(script).not.toContain("bun ");
      expect(script).not.toContain("bunx");
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading "@better-auth/core" from packageJson.overrides; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.6.2");
    expect(
      await readFile(
        pathModule.join(projectDir, "electron", "README.md"),
        "utf-8"
      )
    ).not.toContain("bun ");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("allows Electron install/build scripts for pnpm scaffolds", async (): Promise<void> => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const projectDir = makeTempDir("electron-pnpm");

    await scaffoldFromTemplate(projectDir, { packageManager: "pnpm" });
    await scaffoldElectron(projectDir, {
      packageManager: "pnpm",
      projectName: "my-chat-app",
    });

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const packageJson = JSON.parse(
      await readFile(
        pathModule.join(projectDir, "electron", "package.json"),
        "utf-8"
      )
    ) as { pnpm?: unknown };
    const workspaceConfig = await readFile(
      pathModule.join(projectDir, "electron", "pnpm-workspace.yaml"),
      "utf-8"
    );

    expect(packageJson.pnpm).toBeUndefined();
    expect(workspaceConfig).toContain("onlyBuiltDependencies:");
    expect(workspaceConfig).toContain("allowBuilds:");
    expect(workspaceConfig).toContain("blockExoticSubdeps: false");
    expect(workspaceConfig).not.toContain("better-sqlite3");
    expect(workspaceConfig).toContain("electron: true");
    expect(workspaceConfig).toContain("electron-winstaller: true");
    expect(workspaceConfig).toContain("esbuild: true");
    expect(workspaceConfig).toContain("fs-xattr: true");
    expect(workspaceConfig).toContain("macos-alias: true");
    expect(workspaceConfig).toContain("sharp: true");
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
