import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import { scaffoldFromTemplate } from "#cli/helpers/scaffold";
import { parsePackageJson } from "#cli/helpers/package-manifest";
import { requireJsonObject } from "#cli/helpers/json-object";

import { installItems } from "#cli/registry/shadcn";

import { observabilityItems } from "../../../registry/src/plugins/observability";
import { syncPlugins } from "./sync-plugins";

const lintInstalledObservability = async (root: string): Promise<void> => {
  const config = path.join(root, "export-rules.json");
  await writeFile(config, JSON.stringify({ rules: {} }));
  const lintProcess = Bun.spawn({
    cmd: [
      path.join(import.meta.dir, "../../../../node_modules/.bin/oxlint"),
      "-c",
      config,
      "--import-plugin",
      "-A",
      "all",
      "-D",
      "import/no-duplicates",
      "-D",
      "typescript/consistent-type-definitions",
      "--no-ignore",
      "--report-unused-disable-directives-severity",
      "error",
      path.join(root, "composition/generated/installed-layout.ts"),
      path.join(root, "composition/generated/installed-instrumentation.ts"),
    ],
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    lintProcess.exited,
    new Response(lintProcess.stdout).text(),
    new Response(lintProcess.stderr).text(),
  ]);
  const diagnosticOutput = `Native export validation failed:\n${stdout}\n${stderr}`;
  expect(exitCode, diagnosticOutput).toBe(0);
};

const roots: string[] = [];
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { force: true, recursive: true });
    })
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-observability-"));
  roots.push(root);
  return root;
};
interface ReadonlyObservabilityItem {
  readonly files: readonly Readonly<
    (typeof observabilityItems)[number]["files"][number]
  >[];
  readonly meta: { readonly chatjs: unknown };
  readonly name: string;
}

const itemFiles = async (item: ReadonlyObservabilityItem) => [
  ...(await Promise.all(
    item.files.map(async (file) => ({
      ...file,
      content: await readFile(
        path.resolve(import.meta.dir, "../../../registry", file.path),
        "utf-8"
      ),
    }))
  )),
  {
    content: JSON.stringify(item.meta.chatjs),
    path: `${item.name}.json`,
    target: `~/plugins/${item.name}/chatjs.json`,
    type: "registry:file" as const,
  },
];

type ReadonlyObservabilityFile = Readonly<{
  content: string;
  target: string;
}>;
// Every subset protects omission as well as independent installation.
for (let mask = 0; mask < 2 ** observabilityItems.length; mask += 1) {
  const selected = observabilityItems.filter(
    (_: unknown, index): number => Math.floor(mask / 2 ** index) % 2
  );
  test(`generates only installed observability imports: ${selected.map((item: { readonly name: string }): string => item.name).join(", ") || "none"}`, async (): Promise<void> => {
    const root = await fixture();
    await Promise.all(
      selected.map(async (item: ReadonlyObservabilityItem): Promise<void> => {
        const files = await itemFiles(item);
        await Promise.all(
          files.map(async (file: ReadonlyObservabilityFile): Promise<void> => {
            const target = path.join(root, file.target.replace(/^~\//u, ""));
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, file.content);
          })
        );
      })
    );
    await syncPlugins(root);
    await lintInstalledObservability(root);
    const layout = await readFile(
      path.join(root, "composition/generated/installed-layout.ts"),
      "utf-8"
    );
    const instrumentation = await readFile(
      path.join(root, "composition/generated/installed-instrumentation.ts"),
      "utf-8"
    );
    const plugins = await readFile(
      path.join(root, "composition/generated/installed.ts"),
      "utf-8"
    );
    expect(instrumentation).not.toContain("sort-imports");
    for (const item of observabilityItems) {
      const output = item.name === "langfuse" ? instrumentation : layout;
      expect(output.includes(`@/plugins/${item.name}/`)).toBe(
        selected.includes(item)
      );
      expect(plugins.includes(`"${item.name}"`)).toBe(selected.includes(item));
    }
    await syncPlugins(root);
    expect(
      await readFile(
        path.join(root, "composition/generated/installed-layout.ts"),
        "utf-8"
      )
    ).toBe(layout);
  });
}

for (const item of observabilityItems) {
  test(`shadcn installs ${item.name} independently into an omitted scaffold`, async (): Promise<void> => {
    const root = await fixture();
    await scaffoldFromTemplate(root);
    const manifest = parsePackageJson(
      await readFile(path.join(root, "package.json"), "utf-8")
    );
    const dependencies = requireJsonObject(
      manifest.dependencies,
      "dependencies"
    );
    for (const dependency of [
      "@vercel/analytics",
      "@vercel/speed-insights",
      "@vercel/otel",
      "langfuse",
      "langfuse-vercel",
    ]) {
      expect(dependencies[dependency]).toBeUndefined();
    }
    const descriptors = await Promise.all(
      observabilityItems.map(
        async (plugin: { readonly name: string }): Promise<boolean> =>
          await Bun.file(
            path.join(root, `plugins/${plugin.name}/chatjs.json`)
          ).exists()
      )
    );
    expect(descriptors).toEqual(observabilityItems.map((): boolean => false));
    // Exercise shadcn's dependency installation without the scaffold's unrelated
    // unpublished workspace packages (the packed generated-app suite covers those).
    // Keep the app AI SDK version so npm does not float Langfuse's peer to latest.
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        dependencies: { ai: dependencies.ai },
        name: "observability-fixture",
      })
    );
    const files = await itemFiles(item);
    const server = Bun.serve({
      fetch: () => Response.json({ ...item, files }),
      hostname: "127.0.0.1",
      port: 0,
    });
    try {
      await installItems(
        [`http://127.0.0.1:${server.port}/${item.name}.json`],
        root
      );
      await syncPlugins(root);
      const installedManifest = parsePackageJson(
        await readFile(path.join(root, "package.json"), "utf-8")
      );
      const installedDependencies = requireJsonObject(
        installedManifest.dependencies,
        "installed dependencies"
      );
      for (const dependency of item.dependencies) {
        const versionSeparator = dependency.lastIndexOf("@");
        const name =
          versionSeparator > 0
            ? dependency.slice(0, versionSeparator)
            : dependency;
        expect(installedDependencies[name]).toBeDefined();
      }
      const registration = await readFile(
        path.join(root, "composition/generated/installed.ts"),
        "utf-8"
      );
      expect(registration).toContain(`"${item.name}"`);
      for (const plugin of observabilityItems.filter(
        (candidate: ReadonlyObservabilityItem): boolean => candidate !== item
      )) {
        expect(registration).not.toContain(`"${plugin.name}"`);
      }
      await rm(path.join(root, files[0].target.replace(/^~\//u, "")));
      expect(syncPlugins(root)).rejects.toThrow("installation is incomplete");
      expect(
        await readFile(
          path.join(root, "composition/generated/installed.ts"),
          "utf-8"
        )
      ).toBe(registration);
    } finally {
      await server.stop(true);
    }
  }, 30_000);
  test(`rejects orphaned and mismatched ${item.name} source before writing registrations`, async (): Promise<void> => {
    const root = await fixture();
    const files = await itemFiles(item);
    await Promise.all(
      files.map(async (file: ReadonlyObservabilityFile): Promise<void> => {
        const target = path.join(root, file.target.replace(/^~\//u, ""));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);
      })
    );
    const descriptor = path.join(root, `plugins/${item.name}/chatjs.json`);
    await rm(descriptor);
    expect(syncPlugins(root)).rejects.toThrow("missing its descriptor");
    await writeFile(
      descriptor,
      JSON.stringify({ ...item.meta.chatjs, id: "mcp" })
    );
    expect(syncPlugins(root)).rejects.toThrow("id must match its directory");
    expect(
      await Bun.file(
        path.join(root, "composition/generated/installed-layout.ts")
      ).exists()
    ).toBe(false);
  });
}
