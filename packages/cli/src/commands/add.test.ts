import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});

test.each(["attachment-uploads", "attachment-uploads-dependency"])(
  "add rejects %s before installing source or generating registrations",
  async (requested) => {
    const id = requested.replace("-dependency", "");
    const root = await mkdtemp(
      path.join(tmpdir(), "chatjs-unsupported-feature-")
    );
    roots.push(root);
    const config = "export default {};\n";
    await writeFile(path.join(root, "chat.config.ts"), config);
    const server = Bun.serve({
      fetch(request): Response {
        if (new URL(request.url).pathname.endsWith("-dependency.json")) {
          return Response.json({
            meta: {
              chatjs: {
                contractVersion: 1,
                id: requested,
                kind: "tool",
                tools: [{ toolExport: "fixtureTool" }],
              },
            },
            name: requested,
            registryDependencies: [
              `http://127.0.0.1:${server.port}/${id}.json`,
            ],
            type: "registry:item",
          });
        }
        return Response.json({
          files: [
            {
              content: "export const installed = true;\n",
              path: "feature.ts",
              target: `~/features/${id}/feature.ts`,
              type: "registry:file",
            },
          ],
          meta: { chatjs: { contractVersion: 1, id, kind: "feature" } },
          name: id,
          type: "registry:item",
        });
      },
      hostname: "127.0.0.1",
      port: 0,
    });
    try {
      const child = Bun.spawn(
        [
          process.execPath,
          path.resolve(import.meta.dir, "../index.ts"),
          "add",
          `http://127.0.0.1:${server.port}/${requested}.json`,
          "--cwd",
          root,
          "--yes",
        ],
        { stderr: "pipe", stdout: "pipe" }
      );
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ]);
      expect(code).toBe(1);
      expect(`${stdout}${stderr}`).toContain(
        `Feature installation is not supported yet: ${id}`
      );
      expect(await readdir(root)).toEqual(["chat.config.ts"]);
      expect(await readFile(path.join(root, "chat.config.ts"), "utf-8")).toBe(
        config
      );
    } finally {
      server.stop(true);
    }
  }
);
