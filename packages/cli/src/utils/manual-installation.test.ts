import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { exportManualInstallation } from "./manual-installation";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    })
  );
});

const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-manual-test-"));
  roots.push(root);
  return root;
};

test("manual export preserves conflicting source and dependencies without reading or changing registrations", async () => {
  const root = await fixture();
  await mkdir(path.join(root, "chatjs/generated"), { recursive: true });
  await writeFile(
    path.join(root, "chatjs/generated/installed-chat.ts"),
    "// app edits\n"
  );
  const requests: string[] = [];
  const registry = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      requests.push(url.pathname);
      const name = url.pathname === "/one.json" ? "one" : "two";
      return Response.json({
        name,
        type: "registry:item",
        registryDependencies: [
          `${url.origin}/${name === "one" ? "two" : "one"}.json`,
        ],
        dependencies: ["example-package@1.0.0"],
        meta: {
          chatjs: { kind: "plugin", id: name, chat: { export: "chat" } },
        },
        files: [
          {
            path: "../../chat.ts",
            target: "~/app/api/example/route.ts",
            type: "registry:file",
            content: `export const name = ${JSON.stringify(name)};\n`,
          },
        ],
      });
    },
  });
  try {
    const output = await exportManualInstallation(root, [
      `http://127.0.0.1:${registry.port}/one.json`,
    ]);
    roots.push(output);
    const manifest = await readFile(
      path.join(output, "manifest.json"),
      "utf-8"
    );
    expect(manifest).toContain("example-package@1.0.0");
    expect(manifest).toContain("~/app/api/example/route.ts");
    expect(
      await readFile(path.join(output, "items/0/0-chat.ts"), "utf-8")
    ).toContain('"one"');
    expect(
      await readFile(path.join(output, "items/1/0-chat.ts"), "utf-8")
    ).toContain('"two"');
    expect(
      await readFile(
        path.join(root, "chatjs/generated/installed-chat.ts"),
        "utf-8"
      )
    ).toBe("// app edits\n");
    expect(await readdir(root)).toEqual(["chatjs"]);
    expect(requests.toSorted()).toEqual(["/one.json", "/two.json"]);
    expect(await readFile(path.join(output, "README.md"), "utf-8")).toContain(
      "placement can activate framework behavior"
    );
  } finally {
    await registry.stop(true);
  }
});

test("CLI offers files-only after a connection failure and exports against a legacy app", async () => {
  const root = await fixture();
  await mkdir(path.join(root, ".chatjs"));
  await writeFile(path.join(root, "chat.config.ts"), "export default {};\n");
  const item = path.join(root, "example.json");
  await writeFile(
    item,
    JSON.stringify({
      name: "example",
      type: "registry:item",
      files: [
        {
          path: "example.ts",
          type: "registry:file",
          target: "~/plugins/example/example.ts",
          content: "export const example = true;\n",
        },
      ],
    })
  );
  const cli = path.resolve(import.meta.dir, "../index.ts");
  const failed = Bun.spawn(["bun", cli, "add", item, "--cwd", root, "--yes"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [failedOut, failedErr, failedCode] = await Promise.all([
    new Response(failed.stdout).text(),
    new Response(failed.stderr).text(),
    failed.exited,
  ]);
  expect(failedCode).toBe(1);
  expect(failedOut + failedErr).toContain("--files-only");
  expect(failedOut + failedErr).toContain("Legacy ChatJS installation layout");
  const manual = Bun.spawn(
    ["bun", cli, "add", item, "--cwd", root, "--files-only"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(manual.stdout).text(),
    new Response(manual.stderr).text(),
    manual.exited,
  ]);
  expect(stderr).toBe("");
  expect(code).toBe(0);
  const output = /Source exported to (?<output>[^\r\n]+)/u
    .exec(stdout)
    ?.groups?.output?.trim();
  expect(output).toBeDefined();
  if (output === undefined || output === "") {
    throw new Error(`Missing manual bundle path: ${stdout}`);
  }
  roots.push(output);
  expect(
    await readFile(path.join(output, "items/0/0-example.ts"), "utf-8")
  ).toContain("example = true");
  const files = await readdir(root);
  expect(files.toSorted()).toEqual([
    ".chatjs",
    "chat.config.ts",
    "example.json",
  ]);
}, 30_000);

test("an incomplete export drains writes and removes its partial bundle", async () => {
  const root = await fixture();
  const item = path.join(root, "incomplete.json");
  await writeFile(
    item,
    JSON.stringify({
      name: "incomplete",
      type: "registry:item",
      files: [
        { path: "missing.ts", type: "registry:file", target: "~/missing.ts" },
        {
          path: "present.ts",
          type: "registry:file",
          target: "~/present.ts",
          content: "export const present = true;\n",
        },
      ],
    })
  );
  const before = await readdir(tmpdir());
  await rejects(
    exportManualInstallation(root, [item]),
    /Registry file has no source/u
  );
  const after = await readdir(tmpdir());
  expect(
    after.filter(
      (name) => name.startsWith("chatjs-manual-") && !before.includes(name)
    )
  ).toEqual([]);
  expect(await readdir(root)).toEqual(["incomplete.json"]);
});
