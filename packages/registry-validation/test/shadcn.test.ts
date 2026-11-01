import { rejects } from "node:assert/strict";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import ts from "typescript";
import { z } from "zod";
import zodPackage from "zod/package.json";
import type { RegistryItem } from "shadcn/schema";
import {
  auditDependencies,
  compareProjects,
  readProjectFiles,
  typecheckProject,
} from "../src/index";
import { withRegistryProject } from "../src/shadcn";
import { createDependencyFixture } from "./fixture";

const jsonObject = z.looseObject({});
const comparable = (file: string): boolean =>
  !file.startsWith("node_modules") &&
  !file.startsWith(".git") &&
  file !== "bun.lock";
const encoder = new TextEncoder();
const fixture = { directory: "", dispose: async () => {} };
beforeAll(async () => {
  Object.assign(fixture, await createDependencyFixture());
});
afterAll(async () => {
  await fixture.dispose();
});

const files = new Map(
  Object.entries({
    "package.json": JSON.stringify({
      name: "notes-app",
      version: "1.0.0",
      type: "module",
      packageManager: `bun@${Bun.version}`,
      dependencies: { typescript: ts.version, zod: zodPackage.version },
    }),
    "components.json": JSON.stringify({
      style: "new-york",
      rsc: false,
      tsx: true,
      tailwind: {
        config: "",
        css: "src/styles.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        ui: "@/components/ui",
        utils: "@/lib/utils",
        lib: "@/lib",
        hooks: "@/hooks",
      },
    }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        module: "preserve",
        target: "esnext",
        skipLibCheck: true,
        types: [],
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    }),
    "src/styles.css": '@import "tailwindcss";',
    "src/index.ts": 'export { note } from "@/lib/notes";',
  }).map(([file, source]) => [file, encoder.encode(source)])
);
const catalog: RegistryItem[] = [
  {
    name: "schema",
    type: "registry:item",
    dependencies: [`zod@${zodPackage.version}`],
    files: [
      {
        type: "registry:file",
        path: "schema.ts",
        target: "~/src/lib/schema.ts",
        content: 'import { z } from "zod"; export const schema = z.string();',
      },
    ],
  },
  {
    name: "notes",
    type: "registry:item",
    registryDependencies: ["@notes/schema"],
    files: [
      {
        type: "registry:file",
        path: "notes.ts",
        target: "~/src/lib/notes.ts",
        content:
          'import { schema } from "@/lib/schema"; export const note = schema.parse("hello");',
      },
    ],
  },
];

test("an unrelated registry validates prerequisites, ownership and parity with the unmodified shadcn CLI", async () => {
  const [schema] = catalog;
  const sources = new Map(
    schema.files?.map((file) => [file.path, file.content ?? ""])
  );
  expect(auditDependencies(schema, sources)).toEqual([]);
  // Even though the consumer already declares zod, the owner's declaration is required.
  expect(
    auditDependencies({ ...schema, dependencies: [] }, sources)[0]?.dependency
  ).toBe("zod");
  let stagedDirectory = "";
  const staged = await withRegistryProject(
    { namespace: "@notes", items: catalog, files },
    async (project) => {
      stagedDirectory = project.directory;
      await project.install(["@notes/notes"]);
      return await project.readFiles();
    }
  );
  expect(
    await Bun.file(path.join(stagedDirectory, "package.json")).exists()
  ).toBe(false);
  expect(
    typecheckProject(staged.result, fixture.directory).diagnostics
  ).toEqual([]);
  expect(staged.timings.cleanupMs).toBeGreaterThanOrEqual(0);
  const actual = await mkdtemp(path.join(tmpdir(), "notes-real-install-"));
  // Independent server and CLI invocation retain the original dependency declarations.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const item = catalog.find(
        (candidate) =>
          new URL(request.url).pathname === `/${candidate.name}.json`
      );
      return item
        ? Response.json(item)
        : new Response("Missing", { status: 404 });
    },
  });
  try {
    await Promise.all(
      [...files].map(async ([file, content]) => {
        await mkdir(path.dirname(path.join(actual, file)), { recursive: true });
        await writeFile(path.join(actual, file), content);
      })
    );
    const components = jsonObject.parse(
      JSON.parse(new TextDecoder().decode(files.get("components.json")))
    );
    await writeFile(
      path.join(actual, "components.json"),
      JSON.stringify({
        ...components,
        registries: { "@notes": `http://127.0.0.1:${server.port}/{name}.json` },
      })
    );
    const child = Bun.spawn(
      [
        "node",
        createRequire(import.meta.url).resolve("shadcn"),
        "add",
        "@notes/notes",
        "--yes",
        "--overwrite",
      ],
      { cwd: actual, stdout: "pipe", stderr: "pipe" }
    );
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) {
      throw new Error(`shadcn failed (${code}): ${stdout}\n${stderr}`);
    }
    expect(
      await compareProjects(
        staged.result,
        await readProjectFiles(actual, comparable),
        {
          include: comparable,
          normalize: (file, content) => {
            if (file === "components.json" || file === "package.json") {
              const config = jsonObject.parse(
                JSON.parse(new TextDecoder().decode(content))
              );
              if (file === "components.json") {
                delete config.registries;
              }
              return config;
            }
            return content;
          },
        }
      )
    ).toEqual([]);
  } finally {
    await server.stop(true);
    await rm(actual, { recursive: true, force: true });
  }
}, 60_000);

test("unsupported effects and unsafe targets fail before installation, and failures clean up", async () => {
  let directory = "";
  await rejects(
    withRegistryProject(
      {
        namespace: "@notes",
        items: [{ ...catalog[0], cssVars: { theme: { color: "red" } } }],
        files,
      },
      async (project) => {
        ({ directory } = project);
        await project.install(["@notes/schema"]);
      }
    ),
    /does not support cssVars/u
  );
  expect(await Bun.file(path.join(directory, "package.json")).exists()).toBe(
    false
  );
  await rejects(
    withRegistryProject(
      {
        namespace: "@notes",
        items: [
          {
            name: "escape",
            type: "registry:item",
            files: [
              {
                path: "escape.ts",
                target: "~/../escape.ts",
                type: "registry:file",
                content: "",
              },
            ],
          },
        ],
        files,
      },
      async (project) => {
        await project.install(["@notes/escape"]);
      }
    ),
    /Invalid project path/u
  );
}, 30_000);

test("source-only installation excludes only explicitly verified prerequisites", async () => {
  const items = [{ ...catalog[0], registryDependencies: ["button"] }];
  await rejects(
    withRegistryProject(
      { namespace: "@notes", items, files },
      async (project) => {
        await project.install(["@notes/schema"]);
      }
    ),
    /requires the local/u
  );
  const result = await withRegistryProject(
    {
      namespace: "@notes",
      items,
      files,
      preinstalledRegistryDependencies: ["button"],
    },
    async (project) => {
      await project.install(["@notes/schema"]);
      return await project.readFiles();
    }
  );
  expect(result.result.has("src/lib/schema.ts")).toBe(true);
  expect(
    [...result.result.keys()].some((file) => file.endsWith("button.tsx"))
  ).toBe(false);
});
