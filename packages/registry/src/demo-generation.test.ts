import { expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { tmpdir } from "node:os";

const root = path.resolve(import.meta.dir, "../../..");

// A second installation/checkout: never edit the live preset or app during tests.
test("fresh workers reload declarations, preserve transforms, fan out changes and reconcile removals", async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), "demo-generation-test-"));
  const write = async (file: string, content: string): Promise<void> => {
    const target = path.join(fixture, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  };
  const read = async (file: string): Promise<string> =>
    await readFile(path.join(fixture, file), "utf-8");
  // Older supported Bun versions safely fall back to complete generation.
  const graph = await Bun.build({
    entrypoints: [
      path.join(root, "packages/registry/scripts/registry-mirror/inputs.ts"),
    ],
    packages: "external",
    target: "bun",
    metafile: true,
  });
  expect(graph.success).toBe(true);
  const supportsIncremental = graph.metafile !== undefined;
  let previous: Record<string, string> | undefined;
  const run = async (
    changes?: readonly string[],
    failure = false
  ): Promise<string> => {
    await write("request.json", JSON.stringify({ changes, previous }));
    const worker = Bun.spawn(
      [process.execPath, "fixture-run.ts", "request.json", "result.json"],
      {
        cwd: fixture,
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    // A formatter teardown regression must fail this test, not hang the suite.
    const timeout = setTimeout(() => {
      worker.kill("SIGKILL");
    }, 5000);
    const [code, stdout, stderr] = await Promise.all([
      worker.exited,
      new Response(worker.stdout).text(),
      new Response(worker.stderr).text(),
    ]);
    clearTimeout(timeout);
    if (failure) {
      expect(code).toBe(1);
      return `${stdout}\n${stderr}`;
    }
    if (code !== 0) {
      throw new Error(`${stdout}\n${stderr}`);
    }
    // Only the test transport is parsed here; production validates the same record with Zod.
    previous = z
      .record(z.string(), z.string())
      .parse(JSON.parse(await read("result.json")));
    return stdout;
  };
  try {
    const copies = [
      "packages/registry/src",
      "packages/registry/scripts",
      "packages/cli/src",
      "packages/gateways/src",
      "packages/sandboxes/src",
      "packages/cli/package.json",
      "packages/gateways/package.json",
      "packages/sandboxes/package.json",
      "packages/registry/package.json",
      "apps/chat/components.json",
      "apps/chat/oxfmt.config.ts",
      "oxfmt.config.ts",
      ...[
        ...new Bun.Glob("*.ts").scanSync({
          cwd: path.join(root, "packages/registry"),
        }),
      ].map((file) => `packages/registry/${file}`),
    ];
    await Promise.all(
      copies.map(async (file) => {
        await mkdir(path.dirname(path.join(fixture, file)), {
          recursive: true,
        });
        await cp(path.join(root, file), path.join(fixture, file), {
          recursive: true,
        });
      })
    );
    await write(
      "fixture-run.ts",
      `
import { generateDemo } from "./packages/registry/scripts/demo-generator";
import { createRegistryMirror } from "./packages/registry/scripts/registry-mirror/mirror";
const options = await Bun.file("request.json").json();
let result;
let ownedPaths;
try {
  await createRegistryMirror({
    sourceRoot: process.cwd(), destinationRoot: process.cwd() + "/apps/chat",
    manifestPath: process.cwd() + "/packages/registry/mirror-manifest.json",
    ownedPaths: () => ownedPaths,
    generator: { inputs: [], generate: async () => {
      ({ files: result, ownedPaths } = await generateDemo(options));
      return new Map([...result].map(([file, content]) => [file, new TextEncoder().encode(content)]));
    } },
  }).run();
  await Bun.write("result.json", JSON.stringify(Object.fromEntries(result)));
} catch (error) { console.error(error.message); process.exit(1); }
process.exit(0);
`
    );
    await symlink(
      path.join(root, "node_modules"),
      path.join(fixture, "node_modules")
    );
    const invalidSource =
      "packages/registry/src/plugins/mcp/src/ui/connectors-settings.tsx";
    const validSource = await read(invalidSource);
    await write(invalidSource, `${validSource}\nexport const broken = ;\n`);
    expect(await run(undefined, true)).toContain(
      "Could not format demo source"
    );
    expect(
      await Bun.file(
        path.join(fixture, "packages/registry/mirror-manifest.json.lock")
      ).exists()
    ).toBe(false);
    await write(invalidSource, validSource);
    await run();
    const manifestPath = "packages/registry/mirror-manifest.json";
    const manifestBefore = await stat(path.join(fixture, manifestPath));
    await run();
    const manifestAfter = await stat(path.join(fixture, manifestPath));
    expect(manifestAfter.mtimeMs).toBe(manifestBefore.mtimeMs);

    const manifest = "packages/registry/src/plugins/mcp/manifest.ts";
    const source = "packages/registry/src/plugins/mcp/src/sync-probe.ts";
    const original = await read(manifest);
    // Two declared targets share one canonical source, derived by the installer.
    const declaration = original
      .replace(
        '  "agent/tools/mcp.ts",',
        '  "plugins/mcp/sync-probe.ts",\n  "plugins/mcp/sync-alias.ts",\n  "agent/tools/mcp.ts",'
      )
      .replace(
        'file.slice("plugins/mcp/".length)',
        'file.slice("plugins/mcp/".length).replace("sync-alias.ts", "sync-probe.ts")'
      );
    await write(source, 'export const probe = "first";\n');
    await write(manifest, declaration);
    expect(await run([manifest, source])).toContain("Full generation");
    await write(source, 'export const probe="second";\n');
    expect(await run([source])).toContain(
      supportsIncremental
        ? "Incremental plugin generation (2 outputs)"
        : "Full generation"
    );
    const outputs = await Promise.all(
      ["sync-probe.ts", "sync-alias.ts"].map(
        async (file) => await read(`apps/chat/plugins/mcp/${file}`)
      )
    );
    expect(outputs).toEqual([
      'export const probe = "second";\n',
      'export const probe = "second";\n',
    ]);
    const incremental = await read("result.json");
    await run();
    expect(JSON.parse(await read("result.json"))).toEqual(
      JSON.parse(incremental)
    );

    // An imported value invalidates the optimization even when it is a mapped source.
    await write(
      manifest,
      `import { probe } from "./src/sync-probe";\n${declaration.replace('description: "MCP connectors, management pages, OAuth and composer control"', "description: probe")}`
    );
    await run([manifest]);
    await write(source, 'export const probe = "imported change";\n');
    expect(await run([source])).toContain("Full generation");

    await write(manifest, original);
    expect(await run([manifest])).toContain("Full generation");
    expect(
      await Bun.file(
        path.join(fixture, "apps/chat/plugins/mcp/sync-probe.ts")
      ).exists()
    ).toBe(false);
    expect(
      await Bun.file(
        path.join(fixture, "apps/chat/plugins/mcp/sync-alias.ts")
      ).exists()
    ).toBe(false);
    // Fresh preset imports remove an installed plugin and its ownership.
    const preset = "packages/registry/installation.ts";
    const previousPreset = await read(preset);
    await write(
      preset,
      previousPreset.replace('    "vercel-analytics",\n', "")
    );
    await run([preset]);
    expect(
      await Bun.file(
        path.join(fixture, "apps/chat/plugins/vercel-analytics/chatjs.json")
      ).exists()
    ).toBe(false);
    // Exercise the production process adapter, including its incremental cache.
    await write(
      "adapter-check.ts",
      `
import { strict as assert } from "node:assert";
import { createDemoMirror } from "./packages/registry/scripts/demo-mirror";
const mirror = createDemoMirror();
const source = "packages/registry/src/plugins/mcp/src/runtime/mcp-tools.ts";
const target = "apps/chat/plugins/mcp/runtime/mcp-tools.ts";
const original = await Bun.file(source).text();
await mirror.run();
await Bun.write(source, original + "\\n// adapter edit\\n");
await mirror.run();
const generated = await Bun.file(target).text();
assert.ok(generated.includes("// adapter edit"));
await Bun.write(source, original + "\\nexport const broken = ;\\n");
await assert.rejects(mirror.run());
assert.equal(await Bun.file(target).text(), generated);
await Bun.write(source, original);
await Bun.write(target, "local generated edit");
await mirror.run();
assert.equal(await Bun.file(target).text(), original);
await mirror.run({ check: true });
`
    );
    const adapter = Bun.spawn([process.execPath, "adapter-check.ts"], {
      cwd: fixture,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [adapterCode, adapterOut, adapterErr] = await Promise.all([
      adapter.exited,
      new Response(adapter.stdout).text(),
      new Response(adapter.stderr).text(),
    ]);
    if (adapterCode !== 0) {
      throw new Error(`${adapterOut}\n${adapterErr}`);
    }
    expect(adapterOut).toContain(
      supportsIncremental ? "Incremental plugin generation" : "Full generation"
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}, 60_000);
