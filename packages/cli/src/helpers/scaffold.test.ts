import { rejects } from "node:assert/strict";
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { once } from "node:events";
import { ChildProcess } from "node:child_process";
import {
  mkdir,
  cp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "./scaffold";
import { buildConfigTs } from "./config-builder";
import { initializeShadcn } from "./initialize-shadcn";
import { createRequire } from "node:module";
import { parseJsonObject, requireJsonObject } from "./json-object";
import { parsePackageJson } from "./package-manifest";
import pathModule from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import ts from "typescript";
import { z } from "zod";

// These tests copy/package both maintained runtimes and launch real Node processes.
const SCAFFOLD_INTEGRATION_TIMEOUT_MS = 30_000;
const tempDirs: string[] = [];
const SUCCESS_EXIT_CODE = 0;
const FIRST_TEMP_DIRECTORY_INDEX = 0;
const EXPECTED_SINGLE_ITEM_COUNT = 1;
const MINIMUM_NONEMPTY_FILE_LENGTH = 0;
const originalUserAgent = process.env.npm_config_user_agent;

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

const runGeneratedPackageManagerCommand = async (
  command: readonly string[],
  destination: string,
  packageManager: "bun" | "npm"
): Promise<void> => {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(Bun.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  env.PATH = `${pathModule.resolve(getCliPackageRoot(), "../../node_modules/.bin")}${pathModule.delimiter}${env.PATH ?? ""}`;
  const process = Bun.spawn([...command], {
    cwd: destination,
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  if (exitCode !== SUCCESS_EXIT_CODE) {
    throw new Error(
      `Generated ${packageManager} gateway warning test failed:\n${stdout}\n${stderr}`
    );
  }
};

const runGeneratedGatewaySnapshotWarningTest = async (
  destination: string,
  packageManager: "bun" | "npm"
): Promise<void> => {
  await symlink(
    pathModule.resolve(
      getCliPackageRoot(),
      "../..",
      "apps",
      "chat",
      "node_modules"
    ),
    pathModule.join(destination, "node_modules"),
    "dir"
  );

  const generatedTestPath = pathModule.join(
    destination,
    "scripts",
    "gateway-snapshot-warning.test.ts"
  );
  const generatedTest = await readFile(generatedTestPath, "utf-8");
  const packageManagerConfig = {
    bun: {
      command: [
        "bun",
        "run",
        "test:unit",
        "scripts/gateway-snapshot-warning.test.ts",
      ],
      expectedCommand: "bun run fetch:models",
    },
    npm: {
      command: [
        "npm",
        "run",
        "test:unit",
        "--",
        "scripts/gateway-snapshot-warning.test.ts",
      ],
      expectedCommand: "npm run fetch:models",
    },
  }[packageManager];
  const { command, expectedCommand } = packageManagerConfig;
  expect(generatedTest).toContain(expectedCommand);
  await runGeneratedPackageManagerCommand(command, destination, packageManager);
};

afterEach(async (): Promise<void> => {
  if (originalUserAgent === undefined) {
    delete process.env.npm_config_user_agent;
  } else {
    process.env.npm_config_user_agent = originalUserAgent;
  }
  await Promise.all(
    tempDirs
      .splice(FIRST_TEMP_DIRECTORY_INDEX)
      .map(async (dir): Promise<void> => {
        await rm(dir, { force: true, recursive: true });
      })
  );
});

describe("buildConfigTs", (): void => {
  it("leaves desktop support to plugin installation", (): void => {
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
        feedback: false,
        mcp: false,
        projects: false,
        parallelResponses: true,
      },
      gateway: "vercel",
    });

    expect(output).not.toContain("desktopApp");
    expect(output).toContain("parallelResponses: true");
    expect(output).not.toContain("documents: {");
    expect(output).not.toContain("codeExecution: {");
    expect(output).not.toContain("attachments: false");
  });
  it("leaves uninstalled media configuration to tool contributions", (): void => {
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
        feedback: false,
        mcp: false,
        projects: false,
        parallelResponses: true,
      },
      gateway: "openai-compatible",
    });

    expect(output).toContain('gateway: "openai-compatible"');
    expect(output).not.toContain("image: {");
    expect(output).not.toContain('default: "gpt-image-1"');
    expect(output).not.toMatch(/video:\s*\{[^}]*enabled:/mu);
  });
});

describe("scaffoldFromTemplate", (): void => {
  it("retains stylesheet dependencies when creating without native theme options", async (): Promise<void> => {
    const destination = makeTempDir("default-stylesheets");
    await scaffoldFromTemplate(destination);
    await initializeShadcn(destination, []);

    const stylesheet = await readFile(
      pathModule.join(destination, "app/globals.css"),
      "utf-8"
    );
    const manifest = parsePackageJson(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    expect(stylesheet).toContain('@import "shadcn/tailwind.css"');
    for (const [, specifier] of stylesheet.matchAll(
      /@import "(?<specifier>[^"]+)"/gu
    )) {
      if (specifier.startsWith(".")) {
        continue;
      }
      const packageName = specifier.startsWith("@")
        ? specifier.split("/").slice(0, 2).join("/")
        : specifier.split("/")[0];
      expect(
        manifest.dependencies?.[packageName] ??
          manifest.devDependencies?.[packageName]
      ).toBeString();
    }
  });
  it("scaffolds without a sandbox SDK or persistent capability", async (): Promise<void> => {
    const destination = makeTempDir("no-sandbox");
    await scaffoldFromTemplate(destination);
    const provider = z
      .object({
        createSandboxProvider: z.undefined(),
        supportsPersistentSandbox: z.boolean(),
      })
      .parse(
        await import(pathModule.join(destination, "lib/sandbox/provider.ts"))
      );
    expect(provider.createSandboxProvider).toBeUndefined();
    expect(provider.supportsPersistentSandbox).toBe(false);
    const manifest = z
      .object({ dependencies: z.record(z.string(), z.string()) })
      .parse(
        JSON.parse(
          await readFile(pathModule.join(destination, "package.json"), "utf-8")
        )
      );
    expect(manifest.dependencies["@vercel/sandbox"]).toBeUndefined();
    expect(manifest.dependencies["@daytona/sdk"]).toBeUndefined();
    expect(
      existsSync(
        pathModule.join(destination, "lib/sandbox/vercel-sandbox-env.ts")
      )
    ).toBe(false);
    expect(
      existsSync(pathModule.join(destination, "lib/sandbox/persistent.ts"))
    ).toBe(false);
    expect(
      await readFile(pathModule.join(destination, "agent/sandbox.ts"), "utf-8")
    ).toContain("createAppSandboxEnvironment");
    expect(
      existsSync(pathModule.join(destination, "guest/agent/sandbox.ts"))
    ).toBe(false);
  });
  it("ships maintained workflow and aliased EVE patches as archives", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-patched-runtimes");
    await scaffoldFromTemplate(destination);
    const manifestSource = await readFile(
      pathModule.join(destination, "package.json"),
      "utf-8"
    );
    const manifestValue: unknown = JSON.parse(manifestSource);
    const manifest = z
      .object({ dependencies: z.record(z.string(), z.string()) })
      .parse(manifestValue);
    expect(manifest.dependencies.eve).toBe(
      "file:vendor/chat-js-eve-0.80.1-chatjs.4.tgz"
    );
    const archives = {
      eve: "chat-js-eve-0.80.1-chatjs.4.tgz",
      "@workflow/world-postgres": "workflow-world-postgres-5.0.0-beta.40.tgz",
    };

    await Promise.all(
      Object.entries(archives).map(async ([packageName, archiveName]) => {
        expect(manifest.dependencies[packageName]).toBe(
          `file:vendor/${archiveName}`
        );
        expect(
          await Bun.file(
            pathModule.join(destination, "vendor", archiveName)
          ).exists()
        ).toBe(true);
      })
    );
  });
  it("omits maintainer harnesses while preserving application source and starter tests", async (): Promise<void> => {
    const destination = makeTempDir("maintainer-boundary");
    await scaffoldFromTemplate(destination);
    for (const file of [
      "app/api/eve/[...path]/route-journal.test.ts",
      "lib/db/eve-dispatch.test.ts",
      "lib/eve/operation-token.test.ts",
      "tests/visual",
      "uiverify-archive",
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
      "lib/eve/model-runtime.test.ts",
      "lib/eve/local-sandbox-inventory.test.ts",
      "lib/eve/purge-local-sandbox.test.ts",
      "lib/eve/verify-local-coverage.test.ts",
      "lib/db/eve-document-capabilities.test.ts",
      "lib/db/eve-model-ledger.test.ts",
      "lib/db/eve-billing.test.ts",
      "lib/db/eve-sandbox-run-coverage.test.ts",
      "evals/my-eval.eval.ts",
      "lib/ai/eval-agent.ts",
      "evalite.config.ts",
      "tsconfig.tsbuildinfo",
      "lib/db/migrations/eve-runtime-migration.test.ts",
      "lib/db/eve-search.test.ts",
      "lib/eve/search-text.test.ts",
      "lib/eve/conversation-title.test.ts",
      "lib/db/ai-titles-plugin.test.ts",
      "lib/db/sharing-plugin.test.ts",
      "lib/eve/sharing-transcript.test.ts",
      "lib/eve/search-hook.test.ts",
      "lib/eve/search-backfill.test.ts",
      "scripts/repair-search-preview.sql",
      "lib/db/eve-followup.test.ts",
      "lib/db/feedback-plugin.test.ts",
      "lib/eve/followup-runtime.test.ts",
      "lib/eve/followup-completion.test.ts",
      "lib/eve/followup-sdk-usage.test.ts",
      "lib/eve/followup-suggestions.test.ts",
      "lib/eve/generate-followup-suggestions.test.ts",
      "lib/eve/project-instructions.test.ts",
      "lib/project-icons.test.ts",
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

      "scripts/eve-setup.ts",
      "scripts/eve-setup-config.ts",
      "lib/eve/world-config.ts",
      "vitest.config.ts",
    ]) {
      expect(existsSync(pathModule.join(destination, file))).toBe(true);
    }
    expect(existsSync(pathModule.join(destination, "lib/db/migrations"))).toBe(
      false
    );
    const playwright = await readFile(
      pathModule.join(destination, "playwright.config.ts"),
      "utf-8"
    );
    expect(playwright).not.toContain('name: "visual"');
    expect(playwright).toContain('name: "chat"');
    expect(playwright).toContain('name: "reasoning"');
    expect(playwright).toContain('name: "artifacts"');
    const instructions = await readFile(
      pathModule.join(destination, "AGENTS.md"),
      "utf-8"
    );
    expect(instructions).not.toContain("test:visual:chat");
    expect(instructions).not.toContain("tests/visual/pages");
    expect(instructions).not.toContain("packages/chat-visual-tests");
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
    expect(lint.match(/options: \{ typeAware: true \}/gu)).toHaveLength(
      EXPECTED_SINGLE_ITEM_COUNT
    );
    const lintManifest: unknown = JSON.parse(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    expect(lintManifest).toMatchObject({
      devDependencies: { "oxlint-tsgolint": "7.0.2004" },
      scripts: {
        lint: "next typegen . && ultracite check . --type-aware --report-unused-disable-directives-severity error",
      },
    });
    const manifest = parsePackageJson(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    const devDependencies = requireJsonObject(
      manifest.devDependencies,
      "devDependencies"
    );
    const scripts = requireJsonObject(manifest.scripts, "scripts");
    for (const dependency of [
      "@electric-sql/pglite",
      "pg",
      "@types/pg",
      "evalite",
      "better-sqlite3",
    ]) {
      expect(devDependencies[dependency]).toBeUndefined();
    }
    expect(manifest.overrides?.evalite).toBeUndefined();
    for (const script of [
      "eval:dev",
      "eval:serve",
      "test:native",
      "test:research:native",
      "test:tools:live",
    ]) {
      expect(scripts[script]).toBeUndefined();
    }
  });
  it("leaves the storage slot and provider peers to registry installation", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-storage");
    await scaffoldFromTemplate(destination);
    const manifest = parsePackageJson(
      await readFile(pathModule.join(destination, "package.json"), "utf-8")
    );
    const dependencies = requireJsonObject(
      manifest.dependencies,
      "dependencies"
    );
    expect(dependencies["files-sdk"]).toBe("2.5.0");
    expect(dependencies["@vercel/blob"]).toBeUndefined();
    expect(dependencies["@aws-sdk/client-s3"]).toBeUndefined();
    expect(
      await Bun.file(
        pathModule.join(destination, "lib/storage-provider.ts")
      ).exists()
    ).toBe(false);
  });
  it("writes a standalone-safe root package.json", async (): Promise<void> => {
    const destination = makeTempDir("chat-app");

    await scaffoldFromTemplate(destination);

    const packageJsonSource = await readFile(
      pathModule.join(destination, "package.json"),
      "utf-8"
    );
    const packageJsonValue: unknown = JSON.parse(packageJsonSource);
    const packageJson = z
      .object({
        dependencies: z.record(z.string(), z.string()),
        overrides: z.object({ "@better-auth/core": z.string() }).optional(),
        packageManager: z.string().optional(),
        scripts: z.record(z.string(), z.string()).optional(),
      })
      .parse(packageJsonValue);

    expect(packageJson.packageManager).toBe(`bun@${Bun.version}`);
    expect(packageJson.dependencies["@better-auth/core"]).toBe("1.6.2");
    expect(packageJson.dependencies["@better-auth/electron"]).toBeUndefined();
    expect(packageJson.dependencies["better-auth"]).toBe("1.6.2");
    expect(packageJson.dependencies["@chat-js/thread"]).toBeUndefined();
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.6.2");
    expect(packageJson.scripts?.build).toBe(
      "tsx lib/db/migrate.ts --deployment && eve build && next build"
    );
    expect(packageJson.scripts?.prebuild).not.toContain("@chat-js/thread");
    expect(packageJson.scripts?.["redis:connect"]).toBeUndefined();
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
  it("rewrites the generated web app to be npm-friendly", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-npm");

    await scaffoldFromTemplate(destination, { packageManager: "npm" });

    const packageJsonSource = await readFile(
      pathModule.join(destination, "package.json"),
      "utf-8"
    );
    const packageJsonValue: unknown = JSON.parse(packageJsonSource);
    const packageJson = z
      .object({
        packageManager: z.string().optional(),
        scripts: z.record(z.string(), z.string()),
      })
      .parse(packageJsonValue);

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
        pathModule.join(
          destination,
          "scripts",
          "environment-validation-report.ts"
        ),
        "utf-8"
      )
    ).toContain("npm run fetch:models");
    await runGeneratedGatewaySnapshotWarningTest(destination, "npm");
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
        neonFiles.map(
          async (file): Promise<boolean> =>
            await Bun.file(
              pathModule.join(destination, "scripts", file)
            ).exists()
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
  it("keeps Bun commands in the generated gateway snapshot warning", async (): Promise<void> => {
    const destination = makeTempDir("chat-app-bun-gateway-warning");

    await scaffoldFromTemplate(destination);

    const report = await readFile(
      pathModule.join(
        destination,
        "scripts",
        "environment-validation-report.ts"
      ),
      "utf-8"
    );
    expect(report).toContain("bun run fetch:models");
    expect(report).not.toContain("npm run fetch:models");
    await runGeneratedGatewaySnapshotWarningTest(destination, "bun");
  });
  it("allows known native package build scripts for pnpm scaffolds", async (): Promise<void> => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const destination = makeTempDir("chat-app-pnpm");

    await scaffoldFromTemplate(destination, { packageManager: "pnpm" });

    const packageJsonSource = await readFile(
      pathModule.join(destination, "package.json"),
      "utf-8"
    );
    const packageJsonValue: unknown = JSON.parse(packageJsonSource);
    const packageJson = z
      .object({ packageManager: z.string().optional() })
      .parse(packageJsonValue);
    const workspaceConfig = await readFile(
      pathModule.join(destination, "pnpm-workspace.yaml"),
      "utf-8"
    );

    expect(packageJson.packageManager).toBe("pnpm@10.33.1");
    expect(workspaceConfig).toContain("onlyBuiltDependencies:");
    expect(workspaceConfig).toContain("allowBuilds:");
    expect(workspaceConfig).not.toContain("better-sqlite3");
    expect(workspaceConfig).toContain('"@mongodb-js/zstd": true');
    expect(workspaceConfig).toContain("node-liblzma: true");
    expect(workspaceConfig).toContain("cbor-extract: true");
    expect(workspaceConfig).toContain("electron: true");
    expect(workspaceConfig).toContain("electron-winstaller: true");
    expect(workspaceConfig).toContain("esbuild: true");
    expect(workspaceConfig).toContain("fs-xattr: true");
    expect(workspaceConfig).toContain("macos-alias: true");
    expect(workspaceConfig).toContain("sharp: true");
  });
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
        pathModule.join(destination, "chatjs", "generated", "tools.ts"),
        "utf-8"
      )
    ).not.toContain("getWeather");
    expect(
      await readFile(
        pathModule.join(destination, "chatjs", "generated", "ui.ts"),
        "utf-8"
      )
    ).not.toContain("GetWeatherRenderer");
  });
  it(
    "falls back to repo source apps when synced templates are missing",
    async (): Promise<void> => {
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
        expect(electronTsconfig).not.toContain('"../next-env.d.ts"');
        expect(electronTsconfig).not.toContain('"../electron.d.ts"');
        expect(electronTsconfig).not.toContain("../chat/");
        expect(existsSync(pathModule.join(projectDir, "electron.d.ts"))).toBe(
          false
        );
        const lintConfig = await readFile(
          pathModule.join(projectDir, "oxlint.config.ts"),
          "utf-8"
        );
        expect(
          lintConfig.match(/options: \{ typeAware: true \}/gu)
        ).toHaveLength(EXPECTED_SINGLE_ITEM_COUNT);
        const lintManifest: unknown = JSON.parse(
          await readFile(pathModule.join(projectDir, "package.json"), "utf-8")
        );
        expect(lintManifest).toMatchObject({
          devDependencies: { "oxlint-tsgolint": "7.0.2004" },
          scripts: {
            lint: "next typegen . && ultracite check . --type-aware --report-unused-disable-directives-severity error",
          },
        });

        const packageJsonSource = await readFile(
          pathModule.join(projectDir, "package.json"),
          "utf-8"
        );
        const packageJsonValue: unknown = JSON.parse(packageJsonSource);
        const packageJson = z
          .object({ dependencies: z.record(z.string(), z.string()) })
          .parse(packageJsonValue);
        const electronPackageJsonSource = await readFile(
          pathModule.join(projectDir, "electron", "package.json"),
          "utf-8"
        );
        const electronPackageJsonValue: unknown = JSON.parse(
          electronPackageJsonSource
        );
        const electronPackageJson = z
          .object({ devDependencies: z.record(z.string(), z.string()) })
          .parse(electronPackageJsonValue);

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
          "file:vendor/chat-js-eve-0.80.1-chatjs.4.tgz"
        );
        expect(packageJson.dependencies["@ai-sdk/mcp"]).toBeUndefined();
        expect(
          packageJson.dependencies["@modelcontextprotocol/sdk"]
        ).toBeUndefined();
        expect(packageJson.dependencies["@vercel/analytics"]).toBeUndefined();
        expect(packageJson.dependencies["@workflow/world-postgres"]).toBe(
          "file:vendor/workflow-world-postgres-5.0.0-beta.40.tgz"
        );
        expect(
          electronPackageJson.devDependencies["@better-auth/electron"]
        ).toBe("1.6.2");
      } finally {
        if (existsSync(backupDir)) {
          await rename(backupDir, templatesDir);
        }
      }
    },
    SCAFFOLD_INTEGRATION_TIMEOUT_MS
  );
});

describe("scaffoldFromGit", (): void => {
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
      expect(result.exitCode).toBe(SUCCESS_EXIT_CODE);
    }

    await scaffoldFromGit(source, destination);

    const packageJsonSource = await readFile(
      pathModule.join(destination, "package.json"),
      "utf-8"
    );
    const packageJsonValue: unknown = JSON.parse(packageJsonSource);
    const packageJson = z
      .object({ dependencies: z.record(z.string(), z.string()) })
      .parse(packageJsonValue);
    expect(packageJson.dependencies).toEqual({});
  });
});

describe("scaffoldElectron", (): void => {
  it("cleans up an incomplete companion so installation can be retried", async () => {
    const projectDir = makeTempDir("electron-rollback");
    await scaffoldFromTemplate(projectDir);
    await writeFile(pathModule.join(projectDir, "tsconfig.json"), "{}");
    await mkdir(pathModule.join(projectDir, "electron"));
    await writeFile(pathModule.join(projectDir, "electron/owned.txt"), "keep");
    await rejects(
      scaffoldElectron(projectDir, { projectName: "test" }),
      /already exists/u
    );
    expect(
      await readFile(pathModule.join(projectDir, "electron/owned.txt"), "utf-8")
    ).toBe("keep");
    await rm(pathModule.join(projectDir, "electron"), { recursive: true });
    await writeFile(
      pathModule.join(projectDir, "tsconfig.json"),
      '{"exclude": "invalid"}'
    );
    await rejects(
      scaffoldElectron(projectDir, { projectName: "test" }),
      /exclude must be an array/u
    );
    expect(existsSync(pathModule.join(projectDir, "electron"))).toBe(false);
  });

  it(
    "runs generated Electron prebuild under Node and tsx",
    async (): Promise<void> => {
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
      await mkdir(pathModule.join(projectDir, "plugins/desktop"), {
        recursive: true,
      });
      await cp(
        pathModule.resolve(
          getCliPackageRoot(),
          "../registry/src/plugins/desktop/src/protocol.ts"
        ),
        pathModule.join(projectDir, "plugins/desktop/protocol.ts")
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
      const branding: unknown = JSON.parse(
        await readFile(pathModule.join(electronDir, "branding.json"), "utf-8")
      );
      expect(branding).toEqual({
        appName: "Node Prebuild",
        appPrefix: "node-prebuild",
        appUrl: "http://localhost:3000",
        orgEmail: "test@example.com",
        orgName: "Test",
        auth: {
          clientId: "electron",
          cookiePrefix: "better-auth",
          callbackPath: "/auth/callback",
        },
      });
      const icons = await Promise.all(
        ["png", "icns", "ico"].map(
          async (extension) =>
            await readFile(
              pathModule.join(electronDir, "build", `icon.${extension}`)
            )
        )
      );
      for (const icon of icons) {
        expect(icon.length).toBeGreaterThan(MINIMUM_NONEMPTY_FILE_LENGTH);
      }

      await Promise.all([
        rm(pathModule.join(electronDir, "branding.json")),
        rm(pathModule.join(electronDir, "build"), { recursive: true }),
      ]);
      await Promise.all([
        mkdir(pathModule.join(electronDir, "branding.json")),
        writeFile(pathModule.join(electronDir, "build"), "blocked"),
      ]);
      for (const { script, errorCode } of [
        { errorCode: "EISDIR", script: "write-branding.ts" },
        { errorCode: "EEXIST", script: "generate-icons.ts" },
      ]) {
        const failed = Bun.spawnSync(
          ["node", resolveDependency("tsx/cli"), `scripts/${script}`],
          { cwd: electronDir, stderr: "pipe", stdout: "pipe" }
        );
        expect(failed.exitCode).toBe(1);
        expect(failed.stderr.toString()).toContain(errorCode);
      }

      // A branding write failure must stop prebuild before icon generation starts.
      await rm(pathModule.join(electronDir, "build"));
      const brandingFailure = Bun.spawnSync(["npm", "run", "prebuild"], {
        cwd: electronDir,
        stderr: "pipe",
        stdout: "pipe",
      });
      expect(brandingFailure.exitCode).toBe(1);
      expect(brandingFailure.stderr.toString()).toContain("EISDIR");
      expect(brandingFailure.stdout.toString()).not.toContain(
        "branding.json written:"
      );
      expect(existsSync(pathModule.join(electronDir, "build"))).toBe(false);

      // A missing input must also fail after the output directory is created.
      await rm(pathModule.join(electronDir, "icon.png"));
      const iconFailure = Bun.spawnSync(["npm", "run", "generate-icons"], {
        cwd: electronDir,
        stderr: "pipe",
        stdout: "pipe",
      });
      expect(iconFailure.exitCode).toBe(1);
      expect(iconFailure.stderr.toString()).toContain("ENOENT");
      expect(iconFailure.stdout.toString()).not.toContain(
        "Generated build/icon"
      );
      for (const extension of ["png", "icns", "ico"]) {
        expect(
          existsSync(pathModule.join(electronDir, "build", `icon.${extension}`))
        ).toBe(false);
      }
    },
    SCAFFOLD_INTEGRATION_TIMEOUT_MS
  );
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
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const commands: {
      args: readonly string[];
      command: string;
      nodeEnv?: string;
    }[] = [];
    let completedBuilds = 0;
    const context = createContext({ process: { env: {} } });
    const configPath = pathModule.join(electronDir, "forge.config.ts");
    const configModule = new SourceTextModule(outputText, {
      context,
      identifier: configPath,
      initializeImportMeta: (meta): void => {
        meta.dirname = electronDir;
        meta.filename = configPath;
        meta.url = pathToFileURL(configPath).href;
      },
    });
    await configModule.link((specifier: Readonly<string>): SyntheticModule => {
      let moduleExports: Record<string, unknown> = {};

      if (specifier === "node:child_process") {
        moduleExports = {
          spawn: (
            command: string,
            args: readonly string[],
            options: { readonly env: Readonly<NodeJS.ProcessEnv> }
          ) => {
            commands.push({ args, command, nodeEnv: options.env.NODE_ENV });
            const child = new ChildProcess();
            queueMicrotask(() => {
              completedBuilds += 1;
              child.emit("close", 0);
            });
            return child;
          },
          spawnSync: (
            command: string,
            args: readonly string[],
            options: { readonly env: Readonly<NodeJS.ProcessEnv> }
          ) => {
            commands.push({ args, command, nodeEnv: options.env.NODE_ENV });
            return { status: 0 };
          },
        };
      } else if (specifier === "node:events") {
        moduleExports = { once };
      } else if (specifier === "node:fs") {
        moduleExports = { existsSync, readFileSync };
      } else if (specifier === "node:path") {
        moduleExports = { default: pathModule };
      } else {
        const makerExportNameBySpecifier: Readonly<Record<string, string>> = {
          "@electron-forge/maker-deb": "MakerDeb",
          "@electron-forge/maker-dmg": "MakerDMG",
          "@electron-forge/maker-rpm": "MakerRpm",
          "@electron-forge/maker-squirrel": "MakerSquirrel",
          "@electron-forge/maker-zip": "MakerZIP",
        };
        const makerExportName = makerExportNameBySpecifier[specifier];
        if (makerExportName === undefined) {
          throw new Error(`Unexpected Forge dependency: ${specifier}`);
        }
        moduleExports = { [makerExportName]: Object };
      }

      return new SyntheticModule(
        Object.keys(moduleExports),
        function initializeMockModule(): void {
          for (const [name, value] of Object.entries(moduleExports)) {
            this.setExport(name, value);
          }
        },
        { context, identifier: specifier }
      );
    });
    await configModule.evaluate();
    const config = z
      .object({
        hooks: z.object({
          generateAssets: z.custom<() => Promise<void>>(
            (value): boolean => typeof value === "function"
          ),
          prePackage: z.custom<() => Promise<void>>(
            (value): boolean => typeof value === "function"
          ),
          preStart: z.custom<() => Promise<void>>(
            (value): boolean => typeof value === "function"
          ),
        }),
      })
      .parse(Reflect.get(configModule.namespace, "default"));
    expect(config).toBeDefined();
    await config.hooks.generateAssets();
    await config.hooks.preStart();
    await config.hooks.prePackage();
    expect(completedBuilds).toBe(2);
    expect(commands).toEqual([
      { args: ["run", "prebuild"], command: "npm", nodeEnv: undefined },
      { args: ["run", "build"], command: "npm", nodeEnv: "development" },
      { args: ["run", "build"], command: "npm", nodeEnv: "production" },
    ]);
  });
  it("pins Better Auth versions in the generated electron app", async (): Promise<void> => {
    const projectDir = makeTempDir("electron");

    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });

    const packageJsonSource = await readFile(
      pathModule.join(projectDir, "electron", "package.json"),
      "utf-8"
    );
    const packageJsonValue: unknown = JSON.parse(packageJsonSource);
    const packageJson = z
      .object({
        devDependencies: z.record(z.string(), z.string()),
        overrides: z.object({ "@better-auth/core": z.string() }).optional(),
        packageManager: z.string().optional(),
        scripts: z.record(z.string(), z.string()),
      })
      .parse(packageJsonValue);

    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+/u);
    expect(
      parseJsonObject(packageJsonSource, "Electron package.json").pnpm
    ).toBeUndefined();
    expect(packageJson.devDependencies["@better-auth/electron"]).toBe("1.6.2");
    expect(packageJson.devDependencies["better-auth"]).toBe("1.6.2");
    expect(packageJson.devDependencies.esbuild).toBeDefined();
    const rootPackageJsonSource = await readFile(
      pathModule.join(projectDir, "package.json"),
      "utf-8"
    );
    const rootPackageJsonValue: unknown = JSON.parse(rootPackageJsonSource);
    const rootPackageJson = z
      .object({ devDependencies: z.record(z.string(), z.string()) })
      .parse(rootPackageJsonValue);
    const rootTsconfigSource = await readFile(
      pathModule.join(projectDir, "tsconfig.json"),
      "utf-8"
    );
    const rootTsconfigValue: unknown = JSON.parse(rootTsconfigSource);
    const rootTsconfig = z
      .object({ exclude: z.array(z.string()).optional() })
      .parse(rootTsconfigValue);
    const electronTsconfig = await readFile(
      pathModule.join(projectDir, "electron", "tsconfig.json"),
      "utf-8"
    );
    expect(electronTsconfig).not.toContain('"../next-env.d.ts"');
    expect(electronTsconfig).not.toContain('"../electron.d.ts"');
    expect(electronTsconfig).not.toContain("../chat/");
    expect(existsSync(pathModule.join(projectDir, "electron.d.ts"))).toBe(
      false
    );

    expect(packageJson.devDependencies.tsx).toBe(
      rootPackageJson.devDependencies.tsx
    );
    expect(rootTsconfig.exclude).toContain("electron");
    for (const script of Object.values(packageJson.scripts)) {
      expect(script).not.toContain("bun ");
      expect(script).not.toContain("bunx");
    }
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.6.2");
    expect(
      existsSync(pathModule.join(projectDir, "electron", "README.md"))
    ).toBe(false);
  });
  it("allows Electron install/build scripts for pnpm scaffolds", async (): Promise<void> => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const projectDir = makeTempDir("electron-pnpm");

    await scaffoldFromTemplate(projectDir, { packageManager: "pnpm" });
    await scaffoldElectron(projectDir, {
      packageManager: "pnpm",
      projectName: "my-chat-app",
    });

    const packageJson = parseJsonObject(
      await readFile(
        pathModule.join(projectDir, "electron", "package.json"),
        "utf-8"
      ),
      "Electron package.json"
    );
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
});
