import zodPackage from "zod/package.json";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { createDependencyFixture } from "./fixture";
import path from "node:path";
import ts from "typescript";
import { typecheckProject } from "../src/index";

const fixture = { directory: "", dispose: async () => {} };
beforeAll(async () => {
  Object.assign(fixture, await createDependencyFixture());
});
afterAll(async () => {
  await fixture.dispose();
});
const timeoutMs = 30_000;

const project = (
  sources: Readonly<Record<string, string>>,
  dependencies: Readonly<Record<string, string>> = {}
): Map<string, Uint8Array> =>
  new Map(
    Object.entries({
      "package.json": JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: { typescript: ts.version, ...dependencies },
      }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          module: "preserve",
          target: "esnext",
          types: [],
        },
        include: ["src"],
      }),
      ...sources,
    }).map(([file, source]) => [file, new TextEncoder().encode(source)])
  );

test(
  "checks cross-file semantics and included files outside the entrypoint",
  () => {
    const files = project({
      "src/index.ts":
        'import { value } from "./value"; export const result: number = value;',
      "src/value.ts": 'export const value = "wrong";',
      "src/unreferenced.ts": "export const wrong: boolean = 42;",
    });
    const result = typecheckProject(files, fixture.directory);
    expect(result.diagnostics.map((item) => [item.file, item.code])).toEqual([
      ["src/index.ts", 2322],
      ["src/unreferenced.ts", 2322],
    ]);
  },
  timeoutMs
);

test(
  "isolates undeclared packages even when they are installed and transitively required",
  () => {
    const files = project(
      {
        "src/index.ts":
          'import { schema } from "fixture-provider"; import { z } from "zod"; export const result = z.string(); export { schema };',
      },
      { "fixture-provider": "1.0.0" }
    );
    expect(
      typecheckProject(files, fixture.directory).diagnostics.map(
        (item) => item.code
      )
    ).toEqual([2307]);
    const declared = project(
      {
        "src/index.ts":
          'import { z } from "zod"; export const schema = z.string();',
      },
      { zod: "^4.3.6" }
    );
    expect(typecheckProject(declared, fixture.directory).diagnostics).toEqual(
      []
    );
  },
  timeoutMs
);

test(
  "does not recover deleted modules or absolute paths from the checkout",
  () => {
    const files = project({
      "src/index.ts": 'export { hidden } from "../checkout-only";',
    });
    expect(
      typecheckProject(files, fixture.directory).diagnostics.map(
        (item) => item.code
      )
    ).toEqual([2307]);
    const escaped = project({
      "src/index.ts": `export { hidden } from ${JSON.stringify(path.join(fixture.directory, "checkout-only.ts"))};`,
    });
    expect(
      typecheckProject(escaped, fixture.directory).diagnostics.map(
        (item) => item.code
      )
    ).toEqual([2307]);
  },
  timeoutMs
);

test(
  "honors config inheritance, includes, excludes, aliases, and casing",
  () => {
    const files = project({
      "tsconfig.json": JSON.stringify({
        extends: "./base.json",
        include: ["src"],
        exclude: ["src/ignored"],
      }),
      "base.json": JSON.stringify({
        compilerOptions: {
          strict: true,
          module: "preserve",
          target: "esnext",
          types: [],
          paths: { "@/*": ["./src/*"] },
        },
      }),
      "src/index.ts":
        'import { value } from "@/value"; export const result: number = value;',
      "src/value.ts": "export const value = 1;",
      "src/ignored/broken.ts": 'export const wrong: number = "x";',
      "outside.ts": 'export const wrong: number = "x";',
    });
    const result = typecheckProject(files, fixture.directory);
    expect(result.diagnostics).toEqual([]);
    expect(result.rootFiles.toSorted()).toEqual([
      "src/index.ts",
      "src/value.ts",
    ]);
    files.set(
      "src/index.ts",
      new TextEncoder().encode('export { value } from "./Value";')
    );
    expect(
      typecheckProject(files, fixture.directory).diagnostics.map(
        (item) => item.code
      )
    ).toEqual([2307]);
  },
  timeoutMs
);

test(
  "fails closed for incompatible dependency versions and malformed compiler config",
  () => {
    const files = project(
      { "src/index.ts": 'export { z } from "zod";' },
      { zod: "0.0.0" }
    );
    expect(() => typecheckProject(files, fixture.directory)).toThrow(
      "expected 0.0.0"
    );
    const malformed = project({
      "src/index.ts": "export {};",
      "tsconfig.json": "{ invalid",
    });
    expect(
      typecheckProject(malformed, fixture.directory).diagnostics.length
    ).toBeGreaterThan(0);
  },
  timeoutMs
);

// A single-file npm tarball: exercise archive identity without extracting it.
const packageArchive = (name: string, version: string): Uint8Array => {
  const encoder = new TextEncoder();
  const source = encoder.encode(JSON.stringify({ name, version }));
  const blockSize = 512;
  const archive = new Uint8Array(blockSize * 4);
  archive.set(encoder.encode("package/package.json"));
  archive.set(
    encoder.encode(`${source.length.toString(8).padStart(11, "0")}\0`),
    124
  );
  archive.fill(32, 148, 156);
  archive[156] = 48;
  const checksum = archive
    .subarray(0, blockSize)
    .reduce((sum, byte) => sum + byte, 0);
  archive.set(
    encoder.encode(`${checksum.toString(8).padStart(6, "0")}\0 `),
    148
  );
  archive.set(source, blockSize);
  return Bun.gzipSync(archive);
};

test(
  "local archives require the prepared dependency's identity and version",
  () => {
    const files = project(
      { "src/index.ts": 'export { z } from "zod";' },
      { zod: "file:vendor/zod.tgz" }
    );
    expect(() => typecheckProject(files, fixture.directory)).toThrow(
      "Missing declared package archive"
    );
    files.set(
      "vendor/zod.tgz",
      packageArchive("wrong-package", zodPackage.version)
    );
    expect(() => typecheckProject(files, fixture.directory)).toThrow(
      "Dependency fixture resolved zod to zod"
    );
    files.set("vendor/zod.tgz", packageArchive("zod", "0.0.0"));
    expect(() => typecheckProject(files, fixture.directory)).toThrow(
      "expected npm:zod@0.0.0"
    );
    files.set("vendor/zod.tgz", packageArchive("zod", zodPackage.version));
    expect(typecheckProject(files, fixture.directory).diagnostics).toEqual([]);
  },
  timeoutMs
);
