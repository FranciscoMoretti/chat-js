import { afterEach, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

import { scaffoldFromTemplate } from "#cli/helpers/scaffold";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installItems } from "#cli/registry/shadcn";
/* oxlint-enable sort-imports */

// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { observabilityItems } from "../../../registry/src/features/observability";
import { syncFeatures } from "./sync-features";

/* oxlint-disable oxc/no-async-await -- Await native export validation of the actual syncFeatures output before this integration case finishes. */
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
      "import/no-named-export",
      "-D",
      "import/prefer-default-export",
      "-D",
      "sort-imports",
      "--no-ignore",
      "--report-unused-disable-directives-severity",
      "error",
      path.join(root, "features/installed-layout.ts"),
      path.join(root, "features/installed-instrumentation.ts"),
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
  // oxlint-disable-next-line no-magic-numbers -- Zero exit status proves both generated export scopes and unused-directive validation pass.
  expect(exitCode, diagnosticOutput).toBe(0);
};
/* oxlint-enable oxc/no-async-await */

const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots
      .splice(0)
      .map((root): Promise<void> => rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fixture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-observability-"));
  roots.push(root);
  return root;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve itemFiles's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const itemFiles = async (item: (typeof observabilityItems)[number]) => [
  ...(await Promise.all(
    item.files.map(async (file) => ({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing file own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Every subset protects omission as well as independent installation.
for (let mask = 0; mask < 2 ** observabilityItems.length; mask += 1) {
  const selected = observabilityItems.filter(
    (_, index): number => Math.floor(mask / 2 ** index) % 2
  );
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`generates only installed observability imports: ${selected.map((item): string => item.name).join(", ") || "none"}`, async (): Promise<void> => {
    const root = await fixture();
    await Promise.all(
      selected.map(async (item): Promise<void> => {
        const files = await itemFiles(item);
        await Promise.all(
          files.map(async (file): Promise<void> => {
            const target = path.join(root, file.target.replace(/^~\//u, ""));
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, file.content);
          })
        );
      })
    );
    await syncFeatures(root);
    await lintInstalledObservability(root);
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
    expect(instrumentation.includes("sort-imports")).toBe(
      selected.some(
        (item: { readonly name: string }) => item.name === "langfuse"
      )
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
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
for (const item of observabilityItems) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`shadcn installs ${item.name} independently into an omitted scaffold`, async (): Promise<void> => {
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
      observabilityItems.map((feature): Promise<boolean> =>
        Bun.file(
          path.join(root, `features/${feature.name}/chatjs.json`)
        ).exists()
      )
    );
    expect(descriptors).toEqual(observabilityItems.map((): boolean => false));
    // Exercise shadcn's dependency installation without the scaffold's unrelated
    // unpublished workspace packages (the packed generated-app suite covers those).
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ dependencies: {}, name: "observability-fixture" })
    );
    const files = await itemFiles(item);
    const server = Bun.serve({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
        (candidate): boolean => candidate !== item
      )) {
        expect(registration).not.toContain(`"${feature.name}"`);
      }
      await rm(path.join(root, files[0].target.replace(/^~\//u, "")));
      expect(syncFeatures(root)).rejects.toThrow("installation is incomplete");
      expect(
        await readFile(path.join(root, "features/installed.ts"), "utf-8")
      ).toBe(registration);
    } finally {
      await server.stop(true);
    }
  }, 30_000);
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`rejects orphaned and mismatched ${item.name} source before writing registrations`, async (): Promise<void> => {
    const root = await fixture();
    const files = await itemFiles(item);
    await Promise.all(
      files.map(async (file): Promise<void> => {
        const target = path.join(root, file.target.replace(/^~\//u, ""));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);
      })
    );
    const descriptor = path.join(root, `features/${item.name}/chatjs.json`);
    await rm(descriptor);
    expect(syncFeatures(root)).rejects.toThrow("missing its descriptor");
    await writeFile(
      descriptor,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item.meta.chatjs own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      JSON.stringify({ ...item.meta.chatjs, id: "mcp" })
    );
    expect(syncFeatures(root)).rejects.toThrow("id must match its directory");
    expect(
      await Bun.file(path.join(root, "features/installed-layout.ts")).exists()
    ).toBe(false);
  });
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
