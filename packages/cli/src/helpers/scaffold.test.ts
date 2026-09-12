import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import pathModule from "node:path";
import { runInNewContext } from "node:vm";

import ts from "typescript";

import { buildConfigTs } from "./config-builder";
import {
  scaffoldElectron,
  scaffoldFromGit,
  scaffoldFromTemplate,
} from "./scaffold";

const { join } = pathModule;

const tempDirs: string[] = [];
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

afterEach(async () => {
  if (originalUserAgent === undefined) {
    delete process.env.npm_config_user_agent;
  } else {
    process.env.npm_config_user_agent = originalUserAgent;
  }
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

describe("buildConfigTs", () => {
  it("writes desktopApp.enabled=false for web-only scaffolds", () => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      builtInTools: {
        codeExecution: false,
        deepResearch: false,
        imageGeneration: false,
        urlRetrieval: false,
        videoGeneration: false,
        webSearch: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      documentTypes: {
        code: true,
        sheet: true,
        text: true,
      },
      gateway: "vercel",
      withElectron: false,
    });

    expect(output).toMatch(
      /desktopApp:\s*\{(?:\s*\/\/[^\n]*\n)*\s*enabled:\s*false,/mu
    );
    expect(output).toContain("parallelResponses: true");
    expect(output).toContain("documents: {");
    expect(output).toContain("text: true");
    expect(output).toContain("code: true");
    expect(output).toContain("sheet: true");
    expect(output).toContain("codeExecution: {");
    expect(output).toContain("enabled: false");
    expect(output).toContain(
      "// File attachments (requires configured file storage)\n    attachments: false,"
    );
  });
  it("writes desktopApp.enabled=true for Electron scaffolds", () => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      builtInTools: {
        codeExecution: false,
        deepResearch: false,
        imageGeneration: false,
        urlRetrieval: false,
        videoGeneration: false,
        webSearch: false,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      documentTypes: {
        code: true,
        sheet: true,
        text: true,
      },
      gateway: "vercel",
      withElectron: true,
    });

    expect(output).toMatch(
      /desktopApp:\s*\{(?:\s*\/\/[^\n]*\n)*\s*enabled:\s*true,/mu
    );
    expect(output).toContain("parallelResponses: true");
    expect(output).toContain("documents: {");
    expect(output).toContain("text: true");
    expect(output).toContain("code: true");
    expect(output).toContain("sheet: true");
    expect(output).toContain("video: {");
    expect(output).toContain("enabled: false");
  });
  it("preserves selected media tools for openai-compatible scaffolds", () => {
    const output = buildConfigTs({
      appName: "My Chat",
      appPrefix: "my-chat",
      appUrl: "http://localhost:3000",
      auth: {
        github: true,
        google: false,
        vercel: false,
      },
      builtInTools: {
        codeExecution: true,
        deepResearch: true,
        imageGeneration: true,
        urlRetrieval: true,
        videoGeneration: true,
        webSearch: true,
      },
      coreFeatures: {
        attachments: false,
        documents: true,
        followupSuggestions: true,
        mcp: false,
        parallelResponses: true,
      },
      documentTypes: {
        code: true,
        sheet: true,
        text: true,
      },
      gateway: "openai-compatible",
      withElectron: false,
    });

    expect(output).toContain('gateway: "openai-compatible"');
    expect(output).toContain("image: {");
    expect(output).toContain('default: "gpt-image-1"');
    expect(output).toMatch(
      /video:\s*\{(?:\s*\/\/[^\n]*\n)*\s*enabled:\s*true,/mu
    );
  });
});

describe("scaffoldFromTemplate", () => {
  it("leaves the storage slot and provider peers to registry installation", async () => {
    const destination = await makeTempDir("chat-app-storage");
    await scaffoldFromTemplate(destination);
    const manifest = JSON.parse(
      await readFile(join(destination, "package.json"), "utf-8")
    );
    expect(manifest.dependencies["files-sdk"]).toBe("2.1.0");
    expect(manifest.dependencies["@vercel/blob"]).toBeUndefined();
    expect(manifest.dependencies["@aws-sdk/client-s3"]).toBeUndefined();
    expect(
      await Bun.file(join(destination, "lib/storage-provider.ts")).exists()
    ).toBe(false);
  });

  it("writes a standalone-safe root package.json", async () => {
    const destination = await makeTempDir("chat-app");

    await scaffoldFromTemplate(destination);

    const packageJson = JSON.parse(
      await readFile(join(destination, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
      dependencies: Record<string, string>;
      overrides?: Record<string, string>;
      scripts?: Record<string, string>;
    };

    expect(packageJson.packageManager).toBe(`bun@${Bun.version}`);
    expect(packageJson.dependencies["@better-auth/core"]).toBe("1.5.6");
    expect(packageJson.dependencies["@better-auth/electron"]).toBe("1.5.6");
    expect(packageJson.dependencies["better-auth"]).toBe("1.5.6");
    expect(packageJson.dependencies["@chat-js/thread"]).toBeUndefined();
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.5.6");
    expect(packageJson.scripts?.prebuild).not.toContain("@chat-js/thread");
    expect(packageJson.scripts?.format).toBe("oxfmt --write .");
    expect(existsSync(join(destination, "biome.jsonc"))).toBe(false);
    expect(existsSync(join(destination, "oxlint.config.ts"))).toBe(true);
    expect(existsSync(join(destination, "oxfmt.config.ts"))).toBe(true);
    const lintBaseline = await readFile(
      join(destination, "oxlint-baseline.json"),
      "utf-8"
    );
    expect(lintBaseline).toContain("lib/thread/");
    expect(lintBaseline).toContain("electron/");
    expect(lintBaseline).not.toContain("packages/thread/src/");

    expect(existsSync(join(destination, "lib", "thread", "react.ts"))).toBe(
      true
    );
    const chatStoreSource = await readFile(
      join(destination, "lib", "stores", "base", "use-chat.ts"),
      "utf-8"
    );
    expect(chatStoreSource).toContain('from "@/lib/thread"');
    expect(chatStoreSource).toContain('from "@/lib/thread/react"');
  });

  it("rewrites the generated web app to be npm-friendly", async () => {
    const destination = await makeTempDir("chat-app-npm");

    await scaffoldFromTemplate(destination, { packageManager: "npm" });

    const packageJson = JSON.parse(
      await readFile(join(destination, "package.json"), "utf-8")
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
      await readFile(join(destination, "playwright.config.ts"), "utf-8")
    ).toContain('command: "npm run dev"');
    expect(
      await readFile(join(destination, "scripts", "check-env.ts"), "utf-8")
    ).toContain("npm run fetch:models");
    expect(
      await readFile(
        join(destination, "lib", "ai", "gateways", "fallback-models.ts"),
        "utf-8"
      )
    ).toContain("npm run fetch:models");
    expect(
      await readFile(join(destination, "scripts", "with-db.sh"), "utf-8")
    ).not.toContain("bun");
    expect(
      await readFile(join(destination, "scripts", "db-branch-use.sh"), "utf-8")
    ).not.toContain("bun");
  });

  it("allows known native package build scripts for pnpm scaffolds", async () => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const destination = await makeTempDir("chat-app-pnpm");

    await scaffoldFromTemplate(destination, { packageManager: "pnpm" });

    const packageJson = JSON.parse(
      await readFile(join(destination, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
    };
    const workspaceConfig = await readFile(
      join(destination, "pnpm-workspace.yaml"),
      "utf-8"
    );

    expect(packageJson.packageManager).toBe("pnpm@10.33.1");
    expect(workspaceConfig).toContain("onlyBuiltDependencies:");
    expect(workspaceConfig).toContain("allowBuilds:");
    expect(workspaceConfig).toContain("better-sqlite3: true");
    expect(workspaceConfig).toContain("electron: true");
    expect(workspaceConfig).toContain("electron-winstaller: true");
    expect(workspaceConfig).toContain("esbuild: true");
    expect(workspaceConfig).toContain("fs-xattr: true");
    expect(workspaceConfig).toContain("macos-alias: true");
    expect(workspaceConfig).toContain("sharp: true");
  });

  it("starts generated apps with an empty installable tool registry", async () => {
    const destination = await makeTempDir("chat-app-tools");

    await scaffoldFromTemplate(destination);

    expect(
      existsSync(join(destination, "tools", "chatjs", "get-weather"))
    ).toBe(false);
    expect(
      await readFile(join(destination, "tools", "chatjs", "tools.ts"), "utf-8")
    ).not.toContain("getWeather");
    expect(
      await readFile(join(destination, "tools", "chatjs", "ui.ts"), "utf-8")
    ).not.toContain("GetWeatherRenderer");
  });

  it("falls back to repo source apps when synced templates are missing", async () => {
    const projectDir = await makeTempDir("chat-app-fallback");
    const templatesDir = join(getCliPackageRoot(), "templates");
    const backupDir = join(
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

      const packageJson = JSON.parse(
        await readFile(join(projectDir, "package.json"), "utf-8")
      ) as {
        dependencies: Record<string, string>;
      };
      const electronPackageJson = JSON.parse(
        await readFile(join(projectDir, "electron", "package.json"), "utf-8")
      ) as {
        devDependencies: Record<string, string>;
      };

      expect(packageJson.dependencies["@better-auth/core"]).toBe("1.5.6");
      expect(electronPackageJson.devDependencies["@better-auth/electron"]).toBe(
        "1.5.6"
      );
    } finally {
      if (existsSync(backupDir)) {
        await rename(backupDir, templatesDir);
      }
    }
  });
});

describe("scaffoldFromGit", () => {
  it("leaves repositories without the ChatJS storage seam untouched", async () => {
    const source = await makeTempDir("plain-git-source");
    const destination = await makeTempDir("plain-git-destination");
    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
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

    const packageJson = JSON.parse(
      await readFile(join(destination, "package.json"), "utf-8")
    ) as { dependencies: Record<string, string> };
    expect(packageJson.dependencies).toEqual({});
  });
});

describe("scaffoldElectron", () => {
  it("runs generated Electron prebuild under Node and tsx", async () => {
    const projectDir = await makeTempDir("electron-node-prebuild");
    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });
    const electronDir = join(projectDir, "electron");
    const nodeModules = join(electronDir, "node_modules");
    const resolveDependency = createRequire(import.meta.url).resolve;
    await mkdir(join(nodeModules, ".bin"), { recursive: true });
    await Promise.all([
      symlink(resolveDependency("tsx/cli"), join(nodeModules, ".bin/tsx")),
      symlink(
        pathModule.dirname(resolveDependency("png2icons/package.json")),
        join(nodeModules, "png2icons"),
        "dir"
      ),
    ]);
    // Isolate app configuration so prebuild needs no environment credentials.
    await writeFile(
      join(projectDir, "lib/config.ts"),
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
    const branding = JSON.parse(
      await readFile(join(electronDir, "branding.json"), "utf-8")
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
        readFile(join(electronDir, "build", `icon.${extension}`))
      )
    );
    for (const icon of icons) {
      expect(icon.length).toBeGreaterThan(0);
    }
  });

  it("runs generated Forge prebuild and build hooks with the selected package manager", async () => {
    const projectDir = await makeTempDir("electron-forge");
    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });
    const electronDir = join(projectDir, "electron");
    await writeFile(
      join(electronDir, "branding.json"),
      JSON.stringify({
        appName: "My Chat App",
        appPrefix: "my-chat-app",
        appUrl: "http://localhost:3000",
      })
    );
    const source = await readFile(
      join(electronDir, "forge.config.ts"),
      "utf-8"
    );
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    });
    const commands: { args: string[]; command: string; nodeEnv?: string }[] =
      [];
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
              args: string[],
              options: { env: NodeJS.ProcessEnv }
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
    await configModule.default?.hooks.generateAssets?.();
    await configModule.default?.hooks.preStart?.();
    await configModule.default?.hooks.prePackage?.();
    expect(commands).toEqual([
      { args: ["run", "prebuild"], command: "npm", nodeEnv: undefined },
      { args: ["run", "build"], command: "npm", nodeEnv: "development" },
      { args: ["run", "build"], command: "npm", nodeEnv: "production" },
    ]);
  });

  it("pins Better Auth versions in the generated electron app", async () => {
    const projectDir = await makeTempDir("electron");

    await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
    await scaffoldElectron(projectDir, {
      packageManager: "npm",
      projectName: "my-chat-app",
    });

    const packageJson = JSON.parse(
      await readFile(join(projectDir, "electron", "package.json"), "utf-8")
    ) as {
      packageManager?: string;
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
      overrides?: Record<string, string>;
      pnpm?: unknown;
    };

    expect(packageJson.packageManager).toMatch(/^npm@\d+\.\d+\.\d+/u);
    expect(packageJson.pnpm).toBeUndefined();
    expect(packageJson.devDependencies["@better-auth/electron"]).toBe("1.5.6");
    expect(packageJson.devDependencies["better-auth"]).toBe("1.5.6");
    expect(packageJson.devDependencies.esbuild).toBeDefined();
    const rootPackageJson = JSON.parse(
      await readFile(join(projectDir, "package.json"), "utf-8")
    ) as {
      devDependencies: Record<string, string>;
    };
    const rootTsconfig = JSON.parse(
      await readFile(join(projectDir, "tsconfig.json"), "utf-8")
    ) as {
      exclude?: string[];
    };
    expect(packageJson.devDependencies.tsx).toBe(
      rootPackageJson.devDependencies.tsx
    );
    expect(rootTsconfig.exclude).toContain("electron");
    for (const script of Object.values(packageJson.scripts)) {
      expect(script).not.toContain("bun ");
      expect(script).not.toContain("bunx");
    }
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.5.6");
    expect(
      await readFile(join(projectDir, "electron", "README.md"), "utf-8")
    ).not.toContain("bun ");
  });

  it("allows Electron install/build scripts for pnpm scaffolds", async () => {
    process.env.npm_config_user_agent = "pnpm/10.33.1";
    const projectDir = await makeTempDir("electron-pnpm");

    await scaffoldFromTemplate(projectDir, { packageManager: "pnpm" });
    await scaffoldElectron(projectDir, {
      packageManager: "pnpm",
      projectName: "my-chat-app",
    });

    const packageJson = JSON.parse(
      await readFile(join(projectDir, "electron", "package.json"), "utf-8")
    ) as { pnpm?: unknown };
    const workspaceConfig = await readFile(
      join(projectDir, "electron", "pnpm-workspace.yaml"),
      "utf-8"
    );

    expect(packageJson.pnpm).toBeUndefined();
    expect(workspaceConfig).toContain("onlyBuiltDependencies:");
    expect(workspaceConfig).toContain("allowBuilds:");
    expect(workspaceConfig).toContain("blockExoticSubdeps: false");
    expect(workspaceConfig).toContain("better-sqlite3: true");
    expect(workspaceConfig).toContain("electron: true");
    expect(workspaceConfig).toContain("electron-winstaller: true");
    expect(workspaceConfig).toContain("esbuild: true");
    expect(workspaceConfig).toContain("fs-xattr: true");
    expect(workspaceConfig).toContain("macos-alias: true");
    expect(workspaceConfig).toContain("sharp: true");
  });
});
