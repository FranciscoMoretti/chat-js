import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "bun:test";
import sharp from "sharp";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));

test("brand sync exports social sizes and removes only retired artwork", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "chatjs-brand-sync-"));
  const brand = path.join(fixture, "packages/brand");
  try {
    await cp(packageRoot, brand, {
      recursive: true,
      filter: (source) => !source.split(path.sep).includes("node_modules"),
    });
    await symlink(
      path.resolve(packageRoot, "../../node_modules"),
      path.join(fixture, "node_modules")
    );
    // Resolve from this workspace instead of relying on the installer's hoisting layout.
    await mkdir(path.join(brand, "node_modules"), { recursive: true });
    await symlink(
      path.dirname(fileURLToPath(import.meta.resolve("sharp/package.json"))),
      path.join(brand, "node_modules/sharp")
    );
    const generate = async (check = false) => {
      const child = Bun.spawn(
        [
          process.execPath,
          path.join(brand, "scripts/generate.ts"),
          ...(check ? ["--check"] : []),
        ],
        {
          cwd: fixture,
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      return { code, output: stdout + stderr };
    };
    const generated = await generate();
    assert.equal(generated.code, 0, generated.output);
    await Promise.all(
      ["dark", "white"].flatMap((theme) =>
        (
          [
            ["og", 1200, 630],
            ["github", 1280, 640],
          ] as const
        ).map(async ([format, width, height]) => {
          const image = await sharp(
            path.join(brand, `assets/social/${format}-${theme}.png`)
          ).metadata();
          assert.equal(image.width, width);
          assert.equal(image.height, height);
        })
      )
    );
    const mirrored = path.join(fixture, "apps/site/public/home/blocks");
    await writeFile(
      path.join(mirrored, "notes.txt"),
      "Keep non-artwork files."
    );
    await rename(
      path.join(brand, "assets/product-blocks/mcp.svg"),
      path.join(brand, "assets/product-blocks/mcp-renamed.svg")
    );
    const check = await generate(true);
    assert.equal(check.code, 1);
    assert.ok(check.output.includes(path.join("blocks", "mcp.svg")));
    await readFile(path.join(mirrored, "mcp.svg"));
    const regenerated = await generate();
    assert.equal(regenerated.code, 0, regenerated.output);
    await assert.rejects(readFile(path.join(mirrored, "mcp.svg")), {
      code: "ENOENT",
    });
    await readFile(path.join(mirrored, "mcp-renamed.svg"));
    assert.equal(
      await readFile(path.join(mirrored, "notes.txt"), "utf-8"),
      "Keep non-artwork files."
    );
    const clean = await generate(true);
    assert.equal(clean.code, 0, clean.output);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 30_000);
