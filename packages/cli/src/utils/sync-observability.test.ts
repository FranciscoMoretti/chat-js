import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { observabilityItems } from "../../../registry/src/features/observability";
import { scaffoldFromTemplate } from "../helpers/scaffold";
import { installItems } from "../registry/shadcn";
import { syncFeatures } from "./sync-features";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-observability-"));
  roots.push(root);
  return root;
};
const itemFiles = async (item: (typeof observabilityItems)[number]) => [
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
    target: `~/features/${item.name}/chatjs.json`,
    type: "registry:file" as const,
  },
];

// Every subset protects omission as well as independent installation.
for (let mask = 0; mask < 2 ** observabilityItems.length; mask += 1) {
  const selected = observabilityItems.filter(
    (_, index) => Math.floor(mask / 2 ** index) % 2
  );
  test(`generates only installed observability imports: ${selected.map((item) => item.name).join(", ") || "none"}`, async () => {
    const root = await fixture();
    await Promise.all(
      selected.map(async (item) => {
        const files = await itemFiles(item);
        await Promise.all(
          files.map(async (file) => {
            const target = path.join(root, file.target.replace(/^~\//u, ""));
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, file.content);
          })
        );
      })
    );
    await syncFeatures(root);
    const layout = await readFile(
      path.join(root, "features/installed-layout.ts"),
      "utf-8"
    );
    const instrumentation = await readFile(
      path.join(root, "features/installed-instrumentation.ts"),
      "utf-8"
    );
    const features = await readFile(
      path.join(root, "features/installed.ts"),
      "utf-8"
    );
    for (const item of observabilityItems) {
      const output = item.name === "langfuse" ? instrumentation : layout;
      expect(output.includes(`@/features/${item.name}/`)).toBe(
        selected.includes(item)
      );
      expect(features.includes(`"${item.name}"`)).toBe(selected.includes(item));
    }
    await syncFeatures(root);
    expect(
      await readFile(path.join(root, "features/installed-layout.ts"), "utf-8")
    ).toBe(layout);
  });
}

for (const item of observabilityItems) {
  test(`shadcn installs ${item.name} independently into an omitted scaffold`, async () => {
    const root = await fixture();
    await scaffoldFromTemplate(root);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const manifest = JSON.parse(
      await readFile(path.join(root, "package.json"), "utf-8")
    );
    for (const dependency of [
      "@vercel/analytics",
      "@vercel/speed-insights",
      "@vercel/otel",
      "langfuse",
      "langfuse-vercel",
    ]) {
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      expect(manifest.dependencies[dependency]).toBeUndefined();
    }
    const descriptors = await Promise.all(
      observabilityItems.map((feature) =>
        Bun.file(
          path.join(root, `features/${feature.name}/chatjs.json`)
        ).exists()
      )
    );
    expect(descriptors).toEqual(observabilityItems.map(() => false));
    // Exercise shadcn's dependency installation without the scaffold's unrelated
    // unpublished workspace packages (the packed generated-app suite covers those).
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: {}, name: "observability-fixture" })
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
      await syncFeatures(root);
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      const installedManifest = JSON.parse(
        await readFile(path.join(root, "package.json"), "utf-8")
      );
      for (const dependency of item.dependencies) {
        const versionSeparator = dependency.lastIndexOf("@");
        const name =
          versionSeparator > 0
            ? dependency.slice(0, versionSeparator)
            : dependency;
        // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
        expect(installedManifest.dependencies[name]).toBeDefined();
      }
      const registration = await readFile(
        path.join(root, "features/installed.ts"),
        "utf-8"
      );
      expect(registration).toContain(`"${item.name}"`);
      for (const feature of observabilityItems.filter(
        (candidate) => candidate !== item
      )) {
        expect(registration).not.toContain(`"${feature.name}"`);
      }
      await rm(path.join(root, files[0].target.replace(/^~\//u, "")));
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(syncFeatures(root)).rejects.toThrow(
        "installation is incomplete"
      );
      expect(
        await readFile(path.join(root, "features/installed.ts"), "utf-8")
      ).toBe(registration);
    } finally {
      // oxlint-disable-next-line typescript/no-floating-promises -- The test intentionally starts this operation before inspecting intermediate state; its completion is controlled by the surrounding fixture.
      server.stop(true);
    }
  }, 30_000);

  test(`rejects orphaned and mismatched ${item.name} source before writing registrations`, async () => {
    const root = await fixture();
    const files = await itemFiles(item);
    await Promise.all(
      files.map(async (file) => {
        const target = path.join(root, file.target.replace(/^~\//u, ""));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);
      })
    );
    const descriptor = path.join(root, `features/${item.name}/chatjs.json`);
    await rm(descriptor);
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(syncFeatures(root)).rejects.toThrow("missing its descriptor");
    await writeFile(
      descriptor,
      JSON.stringify({ ...item.meta.chatjs, id: "mcp" })
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
    await expect(syncFeatures(root)).rejects.toThrow(
      "id must match its directory"
    );
    expect(
      await Bun.file(path.join(root, "features/installed-layout.ts")).exists()
    ).toBe(false);
  });
}
