import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { normalizeScaffoldContent } from "./scaffold-content";

const createFixture = async (
  manifest: string,
  tsconfig = '{"compilerOptions":{"paths":{"@/*":["./*"]}}}'
): Promise<string> => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "scaffold-json-contract-")
  );
  const files = {
    "oxlint.config.ts":
      "export default { options: { typeAware: true }, overrides: [] };",
    "package.json": manifest,
    "playwright.config.ts": "export default {};",
    "tsconfig.json": tsconfig,
  };
  await Promise.all(
    Object.entries(files).map(
      async ([filename, source]: readonly [string, string]): Promise<void> => {
        await writeFile(path.join(directory, filename), source);
      }
    )
  );
  return directory;
};

const sourceManifest =
  '{"z_extension":{"keep":["nested"]},"dependencies":{"keep":"^1","diff":"^1","@lexical/react":"^1","@lexical/list":"^1"},"devDependencies":{"pg":"^1","retain":"^1"},"scripts":{"keep":"command","test:tools:live":"bad"},"overrides":{"evalite":"^1","keep":{"nested":"value"}}}';
const normalizedManifest = `{
  "z_extension": {
    "keep": [
      "nested"
    ]
  },
  "dependencies": {
    "keep": "^1",
    "@lexical/react": "^1"
  },
  "devDependencies": {
    "retain": "^1"
  },
  "scripts": {
    "keep": "command"
  },
  "overrides": {
    "keep": {
      "nested": "value"
    }
  }
}
`;
const sourceTsConfig =
  '{"z_extension":{"keep":"nested"},"compilerOptions":{"paths":{"@/*":["./*"],"@eve-test/*":["./eve"],"@world-postgres-test/*":["./postgres"],"@custom/*":["./custom"]},"target":"ESNext"},"include":["**/*.ts"]}';
const normalizedTsConfig = `{
  "z_extension": {
    "keep": "nested"
  },
  "compilerOptions": {
    "paths": {
      "@/*": [
        "./*"
      ],
      "@custom/*": [
        "./custom"
      ]
    },
    "target": "ESNext"
  },
  "include": [
    "**/*.ts"
  ]
}
`;

test("normalizes the original JSON objects while preserving extensions and property order", async () => {
  const directory = await createFixture(sourceManifest, sourceTsConfig);
  try {
    await normalizeScaffoldContent(directory);
    expect(await readFile(path.join(directory, "package.json"), "utf-8")).toBe(
      normalizedManifest
    );
    expect(await readFile(path.join(directory, "tsconfig.json"), "utf-8")).toBe(
      normalizedTsConfig
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("preserves optional null maps instead of replacing or dropping their own fields", async () => {
  const directory = await createFixture(
    '{"z_extension":"keep","dependencies":null,"devDependencies":null,"scripts":null,"overrides":null}'
  );
  try {
    await normalizeScaffoldContent(directory);
    expect(await readFile(path.join(directory, "package.json"), "utf-8"))
      .toBe(`{
  "z_extension": "keep",
  "dependencies": null,
  "devDependencies": null,
  "scripts": null,
  "overrides": null
}
`);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

const invalidManifests = [
  "[]",
  "null",
  '{"dependencies":[]}',
  '{"devDependencies":"invalid"}',
  '{"overrides":true}',
  '{"scripts":[]}',
] as const;
for (const manifest of invalidManifests) {
  test(`rejects invalid template map shape before rewriting ${manifest}`, async () => {
    const directory = await createFixture(manifest);
    try {
      try {
        await normalizeScaffoldContent(directory);
        throw new Error("Expected the template map to be rejected.");
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
      }
      expect(
        await readFile(path.join(directory, "package.json"), "utf-8")
      ).toBe(manifest);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
