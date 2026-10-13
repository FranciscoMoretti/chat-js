import { afterEach, expect, it } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { create } from "./create";
import path from "node:path";
import { tmpdir } from "node:os";

const tempDirs: string[] = [];
const FIRST_TEMP_DIRECTORY = 0;
const EXIT_SUCCESS = 0;

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
    tempDirs.splice(FIRST_TEMP_DIRECTORY).map(async (dir) => {
      await rm(dir, { force: true, recursive: true });
    })
  );
});

it.each([false, true])(
  "preserves cloned source without registry access (ChatJS: %s)",
  async (chatjs) => {
    const { writeFile } = await import("node:fs/promises");
    const source = makeTempDir("plain-source");
    const destination = makeTempDir("plain-clone");
    await mkdir(source, { recursive: true });
    const manifest = JSON.stringify({ dependencies: {}, name: "plain-app" });
    await writeFile(path.join(source, "package.json"), manifest);
    const config = "export default { custom: true };\n";
    const customized = "export const customTool = { execute: () => 42 };\n";
    if (chatjs) {
      await mkdir(path.join(source, "tools/chatjs/custom"), {
        recursive: true,
      });
      await mkdir(path.join(source, "lib/ai"), { recursive: true });
      await writeFile(path.join(source, "chat.config.ts"), config);
      await writeFile(
        path.join(source, "lib/ai/gateway.ts"),
        "export const gateway = {};\n"
      );
      await writeFile(
        path.join(source, "tools/chatjs/custom/tool.ts"),
        customized
      );
    }
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
      expect(Bun.spawnSync(["git", ...args], { cwd: source }).exitCode).toBe(
        EXIT_SUCCESS
      );
    }
    await create.parseAsync([destination, "--from-git", source, "--yes"], {
      from: "user",
    });
    expect(
      await Bun.file(path.join(destination, "chat.config.ts")).exists()
    ).toBe(chatjs);
    expect(
      await readFile(path.join(destination, "package.json"), "utf-8")
    ).toBe(manifest);
    if (chatjs) {
      expect(
        await readFile(path.join(destination, "chat.config.ts"), "utf-8")
      ).toBe(config);
      expect(
        await readFile(
          path.join(destination, "tools/chatjs/custom/tool.ts"),
          "utf-8"
        )
      ).toBe(customized);
    }
  }
);

it("rejects retired installer flags explicitly", () => {
  create.exitOverride();
  expect(create.parseAsync(["--no-install"], { from: "user" })).rejects.toThrow(
    "unknown option"
  );
  expect(
    create.parseAsync(["--package-manager"], { from: "user" })
  ).rejects.toThrow("unknown option");
  expect(create.parseAsync(["--registry"], { from: "user" })).rejects.toThrow(
    "unknown option"
  );
});
