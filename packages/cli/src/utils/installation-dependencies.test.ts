import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";

// oxlint-disable-next-line import/no-relative-parent-imports -- Use the existing package-local registry contract and test fixture in the standalone CLI layout.
import { toolDefinitionSchema } from "../../../registry/metadata";

// oxlint-disable-next-line sort-imports -- Preserve ../../../registry/metadata before ./installation-dependencies while their runtime initialization order is still under site review.
import { prepareDependencyUpdate } from "./installation-dependencies";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

// oxlint-disable-next-line eslint/max-statements, eslint/max-lines-per-function -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit. Keep this installation operation and its rollback or test assertions together.
test("replacement prunes only owned, unchanged, unused dependencies", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-dependencies-"));
  try {
    await mkdir(path.join(cwd, ".chatjs"));
    const manifest = path.join(cwd, "package.json");
    const dependencies = {
      custom: "1",
      customVue: "1",
      pinned: "1",
      preexisting: "1",
      retired: "1",
      shared: "1",
    };
    await writeFile(
      manifest,
      JSON.stringify({ dependencies: { preexisting: "1" }, private: true })
    );
    const previous = toolDefinitionSchema.parse({
      contractVersion: 1,
      id: "first",
      kind: "tool",
      slot: "webSearch",
      tools: [{ toolExport: "search" }],
    });
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing previous own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    const next = toolDefinitionSchema.parse({ ...previous, id: "second" });
    const first = await prepareDependencyUpdate(cwd, {
      items: [
        {
          dependencies: Object.keys(dependencies),
          meta: { chatjs: previous },
          name: "first",
          type: "registry:item",
        },
      ],
      providerChanges: [],
      replacements: [],
    });
    await writeFile(manifest, JSON.stringify({ dependencies, private: true }));
    await first();
    await writeFile(path.join(cwd, "custom.ts"), 'import "custom";');
    await mkdir(path.join(cwd, "public"));
    const largeSourceBytes = 1_048_577;
    await writeFile(
      path.join(cwd, "public/photo.png"),
      Buffer.alloc(largeSourceBytes)
    );
    await writeFile(
      path.join(cwd, "component.vue"),
      '<script>import "customVue";</script>'
    );
    await writeFile(path.join(cwd, "yarn.lock"), 'retired@1:\n  version "1"\n');
    await writeFile(
      path.join(cwd, "tsconfig.tsbuildinfo"),
      '"node_modules/retired/index.d.ts"'
    );
    await writeFile(
      manifest,
      JSON.stringify({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing dependencies own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        dependencies: { ...dependencies, pinned: "2" },
        private: true,
      })
    );
    const replace = await prepareDependencyUpdate(cwd, {
      items: [
        {
          dependencies: ["shared"],
          meta: { chatjs: next },
          name: "second",
          type: "registry:item",
        },
      ],
      providerChanges: [],
      replacements: [{ next, previous }],
    });
    const unknownSource = path.join(cwd, "huge.custom-source");
    await writeFile(unknownSource, Buffer.alloc(largeSourceBytes));
    await replace();
    expect(await readFile(manifest, "utf-8")).toContain('"retired": "1"');
    await rm(unknownSource);
    await replace();
    expect(JSON.parse(await readFile(manifest, "utf-8"))).toEqual({
      dependencies: {
        custom: "1",
        customVue: "1",
        pinned: "2",
        preexisting: "1",
        shared: "1",
      },
      private: true,
    });
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
