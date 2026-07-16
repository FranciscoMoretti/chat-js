import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfigTs } from "./config-builder";
import { scaffoldElectron, scaffoldFromGit, scaffoldFromTemplate } from "./scaffold";

const tempDirs: string[] = [];

async function makeTempDir(name: string): Promise<string> {
	const dir = join(tmpdir(), `chat-js-cli-${name}-${crypto.randomUUID()}`);
	tempDirs.push(dir);
	return dir;
}

function getCliPackageRoot(): string {
	return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe("buildConfigTs", () => {
	it("writes desktopApp.enabled=false for web-only scaffolds", () => {
		const output = buildConfigTs({
			appName: "My Chat",
			appPrefix: "my-chat",
			appUrl: "http://localhost:3000",
			withElectron: false,
			gateway: "vercel",
			coreFeatures: {
				attachments: false,
				parallelResponses: true,
				documents: true,
				mcp: false,
				followupSuggestions: true,
			},
			documentTypes: {
				text: true,
				code: true,
				sheet: true,
			},
			builtInTools: {
				webSearch: false,
				urlRetrieval: false,
				deepResearch: false,
				codeExecution: false,
				imageGeneration: false,
				videoGeneration: false,
			},
			auth: {
				google: false,
				github: true,
				vercel: false,
			},
		});

		expect(output).toMatch(/desktopApp:\s*{\s*enabled:\s*false,/m);
		expect(output).toContain("parallelResponses: true");
		expect(output).toContain("documents: {");
		expect(output).toContain("text: true");
		expect(output).toContain("code: true");
		expect(output).toContain("sheet: true");
		expect(output).toContain("codeExecution: {");
		expect(output).toContain("enabled: false");
	});
	it("writes desktopApp.enabled=true for Electron scaffolds", () => {
		const output = buildConfigTs({
			appName: "My Chat",
			appPrefix: "my-chat",
			appUrl: "http://localhost:3000",
			withElectron: true,
			gateway: "vercel",
			coreFeatures: {
				attachments: false,
				parallelResponses: true,
				documents: true,
				mcp: false,
				followupSuggestions: true,
			},
			documentTypes: {
				text: true,
				code: true,
				sheet: true,
			},
			builtInTools: {
				webSearch: false,
				urlRetrieval: false,
				deepResearch: false,
				codeExecution: false,
				imageGeneration: false,
				videoGeneration: false,
			},
			auth: {
				google: false,
				github: true,
				vercel: false,
			},
		});

		expect(output).toMatch(/desktopApp:\s*{\s*enabled:\s*true,/m);
		expect(output).toContain("parallelResponses: true");
		expect(output).toContain("documents: {");
		expect(output).toContain("text: true");
		expect(output).toContain("code: true");
		expect(output).toContain("sheet: true");
		expect(output).toContain("video: {");
		expect(output).toContain("enabled: false");
	});
	it("keeps unsupported media tools disabled for openai-compatible scaffolds", () => {
		const output = buildConfigTs({
			appName: "My Chat",
			appPrefix: "my-chat",
			appUrl: "http://localhost:3000",
			withElectron: false,
			gateway: "openai-compatible",
			coreFeatures: {
				attachments: false,
				parallelResponses: true,
				documents: true,
				mcp: false,
				followupSuggestions: true,
			},
			documentTypes: {
				text: true,
				code: true,
				sheet: true,
			},
			builtInTools: {
				webSearch: true,
				urlRetrieval: true,
				deepResearch: true,
				codeExecution: true,
				imageGeneration: true,
				videoGeneration: true,
			},
			auth: {
				google: false,
				github: true,
				vercel: false,
			},
		});

		expect(output).toContain('gateway: "openai-compatible"');
		expect(output).toContain("image: {");
		expect(output).toContain('default: "gpt-image-1"');
		expect(output).toMatch(/video:\s*{\s*enabled:\s*false,/m);
	});
});

describe("scaffoldFromTemplate", () => {
	it("installs only the selected Files SDK provider dependencies", async () => {
		const destination = await makeTempDir("chat-app-s3");

		await scaffoldFromTemplate(destination, {
			storage: {
				provider: "s3",
				options: { bucket: "uploads", region: "us-east-1" },
			},
		});

		const packageJson = JSON.parse(
			await readFile(join(destination, "package.json"), "utf8"),
		) as { dependencies: Record<string, string> };
		const providerSource = await readFile(
			join(destination, "lib", "storage-provider.ts"),
			"utf8",
		);

		expect(packageJson.dependencies["files-sdk"]).toBe("2.1.0");
		expect(packageJson.dependencies["@vercel/blob"]).toBeUndefined();
		expect(packageJson.dependencies["@aws-sdk/client-s3"]).toBe("^3.700.0");
		expect(packageJson.dependencies["@aws-sdk/s3-presigned-post"]).toBe(
			"^3.700.0",
		);
		expect(packageJson.dependencies["@aws-sdk/s3-request-presigner"]).toBe(
			"^3.700.0",
		);
		expect(providerSource).toContain('import { s3 } from "files-sdk/s3"');
		expect(providerSource).toContain("createAdapter: () => s3(options)");
		expect(providerSource).not.toContain("storageProviderModule");
		expect(providerSource).toContain('"bucket": "uploads"');
	});

	it("writes a standalone-safe root package.json", async () => {
		const destination = await makeTempDir("chat-app");

		await scaffoldFromTemplate(destination);

		const packageJson = JSON.parse(
			await readFile(join(destination, "package.json"), "utf8"),
		) as {
			packageManager?: string;
			dependencies: Record<string, string>;
			overrides?: Record<string, string>;
		};

		expect(packageJson.packageManager).toBe("bun@1.3.1");
		expect(packageJson.dependencies["@better-auth/core"]).toBe("1.5.6");
		expect(packageJson.dependencies["@better-auth/electron"]).toBe("1.5.6");
		expect(packageJson.dependencies["better-auth"]).toBe("1.5.6");
		expect(packageJson.dependencies["@chatjs/thread"]).toBeUndefined();
		expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.5.6");
		expect(existsSync(join(destination, "lib", "thread", "react.ts"))).toBe(
			true,
		);
		const chatStoreSource = await readFile(
			join(destination, "lib", "stores", "base", "use-chat.ts"),
			"utf8",
		);
		expect(chatStoreSource).toContain('from "@/lib/thread"');
		expect(chatStoreSource).toContain('from "@/lib/thread/react"');
	});

	it("rewrites the generated web app to be npm-friendly", async () => {
		const destination = await makeTempDir("chat-app-npm");

		await scaffoldFromTemplate(destination, { packageManager: "npm" });

		const packageJson = JSON.parse(
			await readFile(join(destination, "package.json"), "utf8"),
		) as {
			packageManager?: string;
			scripts: Record<string, string>;
		};

		expect(packageJson.packageManager).toBeUndefined();
		for (const script of Object.values(packageJson.scripts)) {
			expect(script).not.toContain("bun ");
			expect(script).not.toContain("bunx");
		}

		expect(
			await readFile(join(destination, "playwright.config.ts"), "utf8"),
		).toContain('command: "npm run dev"');
		expect(
			await readFile(join(destination, "scripts", "check-env.ts"), "utf8"),
		).toContain("npm run fetch:models");
		expect(
			await readFile(
				join(destination, "lib", "ai", "gateways", "fallback-models.ts"),
				"utf8",
			),
		).toContain("npm run fetch:models");
		expect(
			await readFile(join(destination, "scripts", "with-db.sh"), "utf8"),
		).not.toContain("bun");
		expect(
			await readFile(join(destination, "scripts", "db-branch-use.sh"), "utf8"),
		).not.toContain("bun");
	});

	it("allows known native package build scripts for pnpm scaffolds", async () => {
		const destination = await makeTempDir("chat-app-pnpm");

		await scaffoldFromTemplate(destination, { packageManager: "pnpm" });

		const packageJson = JSON.parse(
			await readFile(join(destination, "package.json"), "utf8"),
		) as {
			packageManager?: string;
		};
		const workspaceConfig = await readFile(
			join(destination, "pnpm-workspace.yaml"),
			"utf8",
		);

		expect(packageJson.packageManager).toBeUndefined();
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
			existsSync(join(destination, "tools", "chatjs", "get-weather")),
		).toBe(false);
		expect(
			await readFile(join(destination, "tools", "chatjs", "tools.ts"), "utf8"),
		).not.toContain("getWeather");
		expect(
			await readFile(join(destination, "tools", "chatjs", "ui.ts"), "utf8"),
		).not.toContain("GetWeatherRenderer");
	});

	it("falls back to repo source apps when synced templates are missing", async () => {
		const projectDir = await makeTempDir("chat-app-fallback");
		const templatesDir = join(getCliPackageRoot(), "templates");
		const backupDir = join(
			tmpdir(),
			`chat-js-cli-templates-${crypto.randomUUID()}`,
		);

		if (existsSync(templatesDir)) {
			await rename(templatesDir, backupDir);
		}

		try {
			await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
			await scaffoldElectron(projectDir, {
				projectName: "my-chat-app",
				packageManager: "npm",
			});

			const packageJson = JSON.parse(
				await readFile(join(projectDir, "package.json"), "utf8"),
			) as {
				dependencies: Record<string, string>;
			};
			const electronPackageJson = JSON.parse(
				await readFile(join(projectDir, "electron", "package.json"), "utf8"),
			) as {
				devDependencies: Record<string, string>;
			};

			expect(packageJson.dependencies["@better-auth/core"]).toBe("1.5.6");
			expect(electronPackageJson.devDependencies["@better-auth/electron"]).toBe(
				"1.5.6",
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
			JSON.stringify({ name: "plain-template", dependencies: {} }),
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

		await scaffoldFromGit(source, destination, {
			storage: { provider: "vercel-blob", options: {} },
		});

		const packageJson = JSON.parse(
			await readFile(join(destination, "package.json"), "utf8"),
		) as { dependencies: Record<string, string> };
		expect(packageJson.dependencies).toEqual({});
	});
});

describe("scaffoldElectron", () => {
	it("pins Better Auth versions in the generated electron app", async () => {
		const projectDir = await makeTempDir("electron");

		await scaffoldFromTemplate(projectDir, { packageManager: "npm" });
		await scaffoldElectron(projectDir, {
			projectName: "my-chat-app",
			packageManager: "npm",
		});

		const packageJson = JSON.parse(
			await readFile(join(projectDir, "electron", "package.json"), "utf8"),
		) as {
			packageManager?: string;
			devDependencies: Record<string, string>;
			scripts: Record<string, string>;
			overrides?: Record<string, string>;
			pnpm?: unknown;
		};

		expect(packageJson.packageManager).toBeUndefined();
		expect(packageJson.pnpm).toBeUndefined();
		expect(packageJson.devDependencies["@better-auth/electron"]).toBe("1.5.6");
		expect(packageJson.devDependencies["better-auth"]).toBe("1.5.6");
		expect(packageJson.devDependencies.esbuild).toBeDefined();
		const rootPackageJson = JSON.parse(
			await readFile(join(projectDir, "package.json"), "utf8"),
		) as {
			devDependencies: Record<string, string>;
		};
		const rootTsconfig = JSON.parse(
			await readFile(join(projectDir, "tsconfig.json"), "utf8"),
		) as {
			exclude?: string[];
		};
		expect(packageJson.devDependencies.tsx).toBe(
			rootPackageJson.devDependencies.tsx,
		);
		expect(rootTsconfig.exclude).toContain("electron");
		for (const script of Object.values(packageJson.scripts)) {
			expect(script).not.toContain("bun ");
			expect(script).not.toContain("bunx");
		}
		expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.5.6");
		expect(
			await readFile(join(projectDir, "electron", "README.md"), "utf8"),
		).not.toContain("bun ");
	});

	it("allows Electron install/build scripts for pnpm scaffolds", async () => {
		const projectDir = await makeTempDir("electron-pnpm");

		await scaffoldFromTemplate(projectDir, { packageManager: "pnpm" });
		await scaffoldElectron(projectDir, {
			projectName: "my-chat-app",
			packageManager: "pnpm",
		});

		const packageJson = JSON.parse(
			await readFile(join(projectDir, "electron", "package.json"), "utf8"),
		) as { pnpm?: unknown };
		const workspaceConfig = await readFile(
			join(projectDir, "electron", "pnpm-workspace.yaml"),
			"utf8",
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
