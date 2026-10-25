import { afterEach, expect, spyOn, test } from "bun:test";
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRegistryMirror } from "../scripts/registry-mirror/mirror";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    })
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "registry-mirror-test-"));
  directories.push(root);
  const destinationRoot = path.join(root, "app");
  await mkdir(destinationRoot);
  const files = new Map([
    ["generated.ts", new TextEncoder().encode("canonical")],
  ]);
  const allowed = ["generated.ts", "renamed.ts", "binary.dat"];
  const options = {
    sourceRoot: root,
    destinationRoot,
    manifestPath: path.join(root, "manifest.json"),
    ownedPaths: () => allowed,
    generator: {
      inputs: ["source.txt"],
      generate: async () => await Promise.resolve(files),
    },
  };
  const mirror = createRegistryMirror(options);
  return { root, files, allowed, options, mirror };
};

test("generated edits are overwritten, missing files restored, unchanged writes skipped, and binary files preserved", async () => {
  const { files, options, mirror } = await fixture();
  files.set("binary.dat", new Uint8Array([0, 255, 1, 128]));
  await mirror.run();
  const target = path.join(options.destinationRoot, "generated.ts");
  const before = await stat(target);
  const manifest = await stat(options.manifestPath);
  await mirror.run();
  const after = await stat(target);
  expect(after.mtimeMs).toBe(before.mtimeMs);
  const afterManifest = await stat(options.manifestPath);
  expect(afterManifest.mtimeMs).toBe(manifest.mtimeMs);
  expect(
    await readFile(path.join(options.destinationRoot, "binary.dat"))
  ).toEqual(Buffer.from([0, 255, 1, 128]));
  expect(JSON.parse(await readFile(options.manifestPath, "utf-8"))).toEqual({
    files: ["binary.dat", "generated.ts"],
    version: 1,
  });
  await writeFile(target, "local edit");
  expect(mirror.run({ check: true })).rejects.toThrow("drift");
  expect(await readFile(target, "utf-8")).toBe("local edit");
  await mirror.run();
  expect(await readFile(target, "utf-8")).toBe("canonical");
  await rm(target);
  await mirror.run();
  await mirror.run({ check: true });
});

test("renames and removals clean up only recorded output, even when edited or no longer in the current plan", async () => {
  const { files, allowed, options, mirror } = await fixture();
  const appFile = path.join(options.destinationRoot, "config.ts");
  await writeFile(appFile, "app owned");
  await mirror.run();
  await writeFile(
    path.join(options.destinationRoot, "generated.ts"),
    "local edit"
  );
  files.delete("generated.ts");
  allowed.splice(allowed.indexOf("generated.ts"), 1);
  files.set("renamed.ts", new TextEncoder().encode("renamed"));
  await mirror.run();
  expect(
    await Bun.file(path.join(options.destinationRoot, "generated.ts")).exists()
  ).toBe(false);
  expect(await readFile(appFile, "utf-8")).toBe("app owned");
  expect(JSON.parse(await readFile(options.manifestPath, "utf-8"))).toEqual({
    files: ["renamed.ts"],
    version: 1,
  });
  files.clear();
  await mirror.run();
  expect(
    await Bun.file(path.join(options.destinationRoot, "renamed.ts")).exists()
  ).toBe(false);
  expect(await readFile(appFile, "utf-8")).toBe("app owned");
});

test("generation failure leaves existing output and manifest untouched and releases the writer", async () => {
  const { options, mirror } = await fixture();
  await mirror.run();
  const before = await readFile(options.manifestPath, "utf-8");
  const broken = createRegistryMirror({
    ...options,
    generator: {
      inputs: [],
      generate: async () =>
        await Promise.reject(new Error("generation failed")),
    },
  });
  expect(broken.run()).rejects.toThrow("generation failed");
  expect(await readFile(options.manifestPath, "utf-8")).toBe(before);
  expect(
    await readFile(path.join(options.destinationRoot, "generated.ts"), "utf-8")
  ).toBe("canonical");
  await mirror.run();
});

test.each([
  "../escape.ts",
  "/absolute.ts",
  "generated/../../escape.ts",
  "config.ts",
  "generated\\file.ts",
])("rejects unauthorized output %s before any publication", async (file) => {
  const { files, options, mirror } = await fixture();
  files.set(file, new TextEncoder().encode("bad"));
  expect(mirror.run()).rejects.toThrow();
  expect(
    await Bun.file(path.join(options.destinationRoot, "generated.ts")).exists()
  ).toBe(false);
  expect(await Bun.file(options.manifestPath).exists()).toBe(false);
});

test("rejects symlinked outputs and parents before publication", async () => {
  const { files, allowed, root, options, mirror } = await fixture();
  await writeFile(path.join(root, "outside"), "external");
  await symlink(
    path.join(root, "outside"),
    path.join(options.destinationRoot, "generated.ts")
  );
  expect(mirror.run()).rejects.toThrow("symlink");
  await rm(path.join(options.destinationRoot, "generated.ts"));
  await symlink(root, path.join(options.destinationRoot, "linked"));
  files.set("linked/outside", new TextEncoder().encode("bad"));
  allowed.push("linked/outside");
  expect(mirror.run()).rejects.toThrow("symlink");
  expect(await readFile(path.join(root, "outside"), "utf-8")).toBe("external");
  expect(
    await Bun.file(path.join(options.destinationRoot, "generated.ts")).exists()
  ).toBe(false);
});

test("validates manifest cleanup paths before writing or deleting", async () => {
  const { root, options, mirror } = await fixture();
  await writeFile(path.join(root, "outside"), "external");
  await writeFile(
    options.manifestPath,
    JSON.stringify({ version: 1, files: ["../outside"] })
  );
  expect(mirror.run()).rejects.toThrow("Unsafe");
  expect(await readFile(path.join(root, "outside"), "utf-8")).toBe("external");
  expect(
    await Bun.file(path.join(options.destinationRoot, "generated.ts")).exists()
  ).toBe(false);
});

test("public watcher reloads source edits and drains generation on abort", async () => {
  const { root, options } = await fixture();
  const source = path.join(root, "source.txt");
  await writeFile(source, "first");
  const ready = Promise.withResolvers<boolean>();
  const entered = Promise.withResolvers<boolean>();
  const finish = Promise.withResolvers<boolean>();
  const shutdown = new AbortController();
  let passes = 0;
  const mirror = createRegistryMirror({
    ...options,
    generator: {
      inputs: ["source.txt"],
      generate: async () => {
        const content = await readFile(source);
        passes += 1;
        if (passes === 2) {
          entered.resolve(true);
          await finish.promise;
        }
        return new Map([["generated.ts", content]]);
      },
    },
  });
  const watching = mirror.watch({
    signal: shutdown.signal,
    onEvent: (event) => {
      if (event.type === "success" && event.settled) {
        ready.resolve(true);
      }
    },
  });
  try {
    await ready.promise;
    await writeFile(source, "second");
    await entered.promise;
    shutdown.abort();
    finish.resolve(true);
    await watching;
    expect(passes).toBe(2);
    expect(
      await readFile(
        path.join(options.destinationRoot, "generated.ts"),
        "utf-8"
      )
    ).toBe("second");
    expect(await Bun.file(`${options.manifestPath}.lock`).exists()).toBe(false);
    expect(await Bun.file(`${options.manifestPath}.watch.lock`).exists()).toBe(
      false
    );
  } finally {
    shutdown.abort();
    finish.resolve(true);
    await watching;
  }
}, 10_000);

test("a partial publication retains cleanup ownership and a later generation repairs it", async () => {
  const { files, allowed, options, mirror } = await fixture();
  await mirror.run();
  files.set("a-new.ts", new TextEncoder().encode("addition"));
  files.set("generated.ts", new TextEncoder().encode("updated"));
  allowed.push("a-new.ts");
  const original = fs.rename;
  const injected = spyOn(fs, "rename").mockImplementation(
    async (...args: Parameters<typeof fs.rename>) => {
      if (args[1] === path.join(options.destinationRoot, "generated.ts")) {
        throw new Error("Publication failed");
      }
      await original(...args);
    }
  );
  try {
    expect(mirror.run()).rejects.toThrow("Publication failed");
  } finally {
    injected.mockRestore();
  }
  expect(
    await readFile(path.join(options.destinationRoot, "a-new.ts"), "utf-8")
  ).toBe("addition");
  files.delete("a-new.ts");
  allowed.splice(allowed.indexOf("a-new.ts"), 1);
  await mirror.run();
  expect(
    await Bun.file(path.join(options.destinationRoot, "a-new.ts")).exists()
  ).toBe(false);
  expect(
    await readFile(path.join(options.destinationRoot, "generated.ts"), "utf-8")
  ).toBe("updated");
  await mirror.run({ check: true });
});
