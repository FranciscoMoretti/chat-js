import { afterEach, expect, it } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { create } from "./create";

const tempDirs: string[] = [];

const makeTempDir = (name: string): string => {
  const dir = path.join(
    tmpdir(),
    `chat-js-create-${name}-${crypto.randomUUID()}`
  );
  tempDirs.push(dir);
  return dir;
};

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true }))
  );
});

it("leaves non-ChatJS Git templates unconfigured through the full create command", async () => {
  const { writeFile } = await import("node:fs/promises");
  const source = makeTempDir("plain-source");
  const destination = makeTempDir("plain-clone");
  await mkdir(source, { recursive: true });
  const manifest = JSON.stringify({ dependencies: {}, name: "plain-app" });
  await writeFile(path.join(source, "package.json"), manifest);
  for (const args of [
    ["init"],
    ["add", "."],
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
    expect(Bun.spawnSync(["git", ...args], { cwd: source }).exitCode).toBe(0);
  }
  const { builtInGateways } =
    await import("../../../registry/src/gateways/catalog");
  await writeFile(
    path.join(source, "gateway.json"),
    JSON.stringify(builtInGateways[0])
  );
  const { builtInStorage } =
    await import("../../../registry/src/storage/catalog");
  await writeFile(
    path.join(source, "storage.json"),
    JSON.stringify(
      builtInStorage.find((item) => item.meta.chatjs.id === "memory")
    )
  );
  await create.parseAsync(
    [
      destination,
      "--from-git",
      source,
      "--gateway",
      path.join(source, "gateway.json"),
      "--storage-provider",
      path.join(source, "storage.json"),
      "--storage-config",
      "{}",
      "--yes",
    ],
    { from: "user" }
  );
  expect(
    await Bun.file(path.join(destination, "chat.config.ts")).exists()
  ).toBe(false);
  expect(await readFile(path.join(destination, "package.json"), "utf-8")).toBe(
    manifest
  );
});

it("rejects retired installer flags explicitly", async () => {
  create.exitOverride();
  for (const flag of ["--no-install", "--package-manager", "--registry"]) {
    await expect(create.parseAsync([flag], { from: "user" })).rejects.toThrow(
      "unknown option"
    );
  }
});
