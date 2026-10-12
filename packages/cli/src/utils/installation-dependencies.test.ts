import { expect, spyOn, test } from "bun:test";
import * as filesystem from "node:fs/promises";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import { tmpdir } from "node:os";

import { toolDefinitionSchema } from "../../../registry/metadata";

import { prepareDependencyUpdate } from "./installation-dependencies";

const installDependencies = async (
  cwd: string
): Promise<() => Promise<void>> => {
  await mkdir(path.join(cwd, ".chatjs"));
  const manifest = path.join(cwd, "package.json");
  await writeFile(manifest, JSON.stringify({ private: true }));
  const previous = toolDefinitionSchema.parse({
    contractVersion: 1,
    id: "first",
    kind: "tool",
    slot: "webSearch",
    tools: [{ toolExport: "search" }],
  });
  const next = toolDefinitionSchema.parse({ ...previous, id: "second" });
  const install = await prepareDependencyUpdate(cwd, {
    items: [
      {
        dependencies: ["alpha", "beta", "retired"],
        meta: { chatjs: previous },
        name: "first",
        type: "registry:item",
      },
    ],
    providerChanges: [],
    replacements: [],
  });
  await writeFile(
    manifest,
    JSON.stringify({
      dependencies: { alpha: "1", retired: "1" },
      devDependencies: { beta: "1" },
      private: true,
    })
  );
  await install();
  return await prepareDependencyUpdate(cwd, {
    items: [],
    providerChanges: [],
    replacements: [{ next, previous }],
  });
};

const orderSourceEntries = async (cwd: string) => {
  const entries = await filesystem.readdir(cwd, { withFileTypes: true });
  return spyOn(filesystem, "readdir").mockResolvedValueOnce(
    entries.toSorted((left, right) => left.name.localeCompare(right.name))
  );
};

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
    expect(
      JSON.parse(
        await readFile(
          path.join(cwd, ".chatjs/installed-dependencies.json"),
          "utf-8"
        )
      )
    ).toEqual({
      items: { "tool:second": ["shared"] },
      owned: { custom: "1", customVue: "1", pinned: "1", shared: "1" },
    });
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("replacement reads each source once for all used and unused candidates", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-dependencies-"));
  try {
    const replace = await installDependencies(cwd);
    const source = path.join(cwd, "source");
    await mkdir(source);
    const alpha = path.join(source, "alpha.ts");
    const beta = path.join(source, "beta.vue");
    const unrelated = path.join(cwd, "unrelated.txt");
    await writeFile(alpha, 'import "alpha";');
    await writeFile(beta, '<script>import "beta";</script>');
    await writeFile(unrelated, "no dependencies here");
    const reads = spyOn(filesystem, "readFile");
    const directories = spyOn(filesystem, "readdir");
    try {
      await replace();
      for (const file of [alpha, beta, unrelated]) {
        expect(
          reads.mock.calls.filter(([target]) => target === file)
        ).toHaveLength(1);
      }
      expect(directories.mock.calls.map(([target]) => target)).toEqual([
        cwd,
        source,
      ]);
    } finally {
      reads.mockRestore();
      directories.mockRestore();
    }
    expect(
      JSON.parse(await readFile(path.join(cwd, "package.json"), "utf-8"))
    ).toEqual({
      dependencies: { alpha: "1" },
      devDependencies: { beta: "1" },
      private: true,
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(cwd, ".chatjs/installed-dependencies.json"),
          "utf-8"
        )
      )
    ).toEqual({ items: {}, owned: { alpha: "1", beta: "1" } });
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test.each(["symlink", "oversized"])(
  "%s source retains every unresolved dependency and stops traversal",
  async (kind) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-dependencies-"));
    try {
      const replace = await installDependencies(cwd);
      await writeFile(path.join(cwd, "00-used.ts"), 'import "alpha";');
      const unknown = path.join(cwd, "10-unknown");
      await (kind === "symlink"
        ? symlink("missing-source", unknown)
        : writeFile(unknown, Buffer.alloc(1_048_577)));
      await writeFile(path.join(cwd, "20-later.ts"), "unreadable later source");
      const manifest = path.join(cwd, "package.json");
      const before = await readFile(manifest, "utf-8");
      const directories = await orderSourceEntries(cwd);
      const originalReadFile = filesystem.readFile;
      const reads = spyOn(filesystem, "readFile")
        .mockImplementationOnce(originalReadFile)
        .mockImplementationOnce(originalReadFile)
        .mockRejectedValue(new Error("Must not read after unknown source"));
      try {
        await replace();
        expect(reads.mock.calls.map(([target]) => target)).toEqual([
          manifest,
          path.join(cwd, "00-used.ts"),
        ]);
      } finally {
        reads.mockRestore();
        directories.mockRestore();
      }
      expect(JSON.parse(await readFile(manifest, "utf-8"))).toEqual(
        JSON.parse(before)
      );
      expect(
        JSON.parse(
          await readFile(
            path.join(cwd, ".chatjs/installed-dependencies.json"),
            "utf-8"
          )
        )
      ).toEqual({ items: {}, owned: { alpha: "1", beta: "1", retired: "1" } });
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  }
);

test("source read failures leave manifest and receipt unchanged", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-dependencies-"));
  try {
    const replace = await installDependencies(cwd);
    await writeFile(path.join(cwd, "00-used.ts"), 'import "alpha";');
    const unreadable = path.join(cwd, "10-unreadable.ts");
    await writeFile(unreadable, "source cannot be read");
    const manifest = path.join(cwd, "package.json");
    const receipt = path.join(cwd, ".chatjs/installed-dependencies.json");
    const beforeManifest = await readFile(manifest, "utf-8");
    const beforeReceipt = await readFile(receipt, "utf-8");
    const failure = new Error(
      `EACCES: permission denied, open '${unreadable}'`
    );
    const directories = await orderSourceEntries(cwd);
    const originalReadFile = filesystem.readFile;
    const reads = spyOn(filesystem, "readFile")
      .mockImplementationOnce(originalReadFile)
      .mockImplementationOnce(originalReadFile)
      .mockRejectedValue(failure);
    const writes = spyOn(filesystem, "writeFile");
    try {
      const result: unknown = await replace().catch((error: unknown) => error);
      expect(result).toBe(failure);
      expect(writes).not.toHaveBeenCalled();
      expect(reads.mock.calls.map(([target]) => target)).toEqual([
        manifest,
        path.join(cwd, "00-used.ts"),
        unreadable,
      ]);
    } finally {
      reads.mockRestore();
      writes.mockRestore();
      directories.mockRestore();
    }
    expect(await readFile(manifest, "utf-8")).toBe(beforeManifest);
    expect(await readFile(receipt, "utf-8")).toBe(beforeReceipt);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("finding all candidates in a subtree skips later unreadable source", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-dependencies-"));
  try {
    const replace = await installDependencies(cwd);
    const source = path.join(cwd, "00-source");
    await mkdir(source);
    const used = path.join(source, "used.ts");
    await writeFile(used, 'import "alpha"; import "beta"; import "retired";');
    await writeFile(
      path.join(cwd, "10-unreadable.ts"),
      "source cannot be read"
    );
    const directories = await orderSourceEntries(cwd);
    const originalReadFile = filesystem.readFile;
    const reads = spyOn(filesystem, "readFile")
      .mockImplementationOnce(originalReadFile)
      .mockImplementationOnce(originalReadFile)
      .mockRejectedValue(
        new Error("Must not read after all candidates are used")
      );
    try {
      await replace();
      expect(reads.mock.calls.map(([target]) => target)).toEqual([
        path.join(cwd, "package.json"),
        used,
      ]);
    } finally {
      reads.mockRestore();
      directories.mockRestore();
    }
    expect(
      JSON.parse(
        await readFile(
          path.join(cwd, ".chatjs/installed-dependencies.json"),
          "utf-8"
        )
      )
    ).toEqual({ items: {}, owned: { alpha: "1", beta: "1", retired: "1" } });
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
