import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create, selectedRegistryToolsRequireStorage } from "./create";

const tempDirs: string[] = [];

function makeTempDir(name: string): string {
  const dir = join(tmpdir(), `chat-js-create-${name}-${crypto.randomUUID()}`);
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("create command", () => {
  it("detects storage requirements only for selected registry tools", () => {
    const registryItems = [
      { name: "generate-image", projectRequirements: ["storage" as const] },
      { name: "word-count" },
    ];

    expect(
      selectedRegistryToolsRequireStorage(registryItems, ["generate-image"])
    ).toBe(true);
    expect(selectedRegistryToolsRequireStorage(registryItems, ["word-count"])).toBe(
      false
    );
    expect(selectedRegistryToolsRequireStorage(registryItems, [])).toBe(false);
  });

  it("ships the selected Files SDK provider without unrelated provider peers", async () => {
    const tempParent = makeTempDir("s3-app");
    const appName = "s3-chat-app";
    const originalCwd = process.cwd();

    await mkdir(tempParent, { recursive: true });
    process.chdir(tempParent);
    try {
      await create.parseAsync(
        [
          appName,
          "--yes",
          "--no-install",
          "--storage-provider",
          "s3",
          "--storage-config",
          '{"bucket":"uploads","region":"us-east-1"}',
        ],
        { from: "user" }
      );
    } finally {
      process.chdir(originalCwd);
    }

    const packageJson = JSON.parse(
      await readFile(join(tempParent, appName, "package.json"), "utf8")
    ) as { dependencies: Record<string, string> };
    const provider = await readFile(
      join(tempParent, appName, "lib", "storage-provider.ts"),
      "utf8"
    );

    expect(packageJson.dependencies["@aws-sdk/client-s3"]).toBe("^3.700.0");
    expect(packageJson.dependencies["@vercel/blob"]).toBeUndefined();
    expect(provider).toContain('from "files-sdk/s3"');
  });

  it("uses the explicitly requested package manager for scaffold defaults", async () => {
    const tempParent = makeTempDir("npm-app");
    const appName = "my-chat-app";
    const originalCwd = process.cwd();

    await mkdir(tempParent, { recursive: true });
    process.chdir(tempParent);
    try {
      await create.parseAsync(
        [appName, "--yes", "--no-install", "--package-manager", "npm"],
        {
          from: "user",
        }
      );
    } finally {
      process.chdir(originalCwd);
    }

    const packageJson = JSON.parse(
      await readFile(join(tempParent, appName, "package.json"), "utf8")
    ) as {
      packageManager?: string;
      overrides?: Record<string, string>;
    };

    expect(packageJson.packageManager).toBeUndefined();
    expect(
      (packageJson as { dependencies?: Record<string, string> }).dependencies?.[
        "@vercel/blob"
      ]
    ).toBeUndefined();
    expect(packageJson.overrides?.["@better-auth/core"]).toBe("1.5.6");
  });

  it("treats storage config as an explicit storage request", async () => {
    const tempParent = makeTempDir("storage-config-app");
    const appName = "storage-config-chat-app";
    const originalCwd = process.cwd();

    await mkdir(tempParent, { recursive: true });
    process.chdir(tempParent);
    try {
      await create.parseAsync(
        [appName, "--yes", "--no-install", "--storage-config", "{}"],
        { from: "user" }
      );
    } finally {
      process.chdir(originalCwd);
    }

    const provider = await readFile(
      join(tempParent, appName, "lib", "storage-provider.ts"),
      "utf8"
    );
    expect(provider).toContain('from "files-sdk/vercel-blob"');
  });
});
