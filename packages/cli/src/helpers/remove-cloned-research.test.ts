import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import {
  researchAgentFiles,
  researchItem,
} from "../../../registry/src/tools/research";
import { removeClonedResearch } from "./remove-cloned-research";

const { dirname, join } = pathModule;

const roots: string[] = [];
const originalRegistryUrl = process.env.CHATJS_REGISTRY_URL;
afterEach(async () => {
  process.env.CHATJS_REGISTRY_URL = originalRegistryUrl;
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
const project = async (descriptor: boolean) => {
  const root = await mkdtemp(join(tmpdir(), "chatjs-clone-research-"));
  roots.push(root);
  const file = join(root, researchAgentFiles[0]);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, 'export default {name: "research"};');
  if (descriptor) {
    const metadata = join(root, "tools/chatjs/deep-research/chatjs.json");
    await mkdir(dirname(metadata), { recursive: true });
    await writeFile(metadata, JSON.stringify(researchItem.meta?.chatjs));
  }
  return { file, root };
};

test("cloning preserves agents when no research bundle owns them", async () => {
  const { root, file } = await project(false);
  await removeClonedResearch(root);
  expect(await Bun.file(file).exists()).toBe(true);
});

test("cloning removes reference agents but refuses customized source", async () => {
  const server = Bun.serve({
    fetch: () =>
      Response.json({
        ...researchItem,
        files: researchAgentFiles.map((file) => ({
          content: 'export default { name: "research" };',
          path: file,
          target: `~/${file}`,
          type: "registry:file",
        })),
      }),
    hostname: "127.0.0.1",
    port: 0,
  });
  process.env.CHATJS_REGISTRY_URL = `http://127.0.0.1:${server.port}/{name}.json`;
  try {
    const clean = await project(true);
    await mkdir(join(clean.root, "agent/subagents/researcher/hooks"), {
      recursive: true,
    });
    await mkdir(join(clean.root, "lib/eve"), { recursive: true });
    await writeFile(
      join(clean.root, "lib/eve/research-tool.test.ts"),
      "reference tests"
    );
    await removeClonedResearch(clean.root);
    expect(await Bun.file(clean.file).exists()).toBe(false);
    expect(
      await Bun.file(join(clean.root, "lib/eve/research-tool.test.ts")).exists()
    ).toBe(false);
    await expect(
      readFile(join(clean.root, "agent/subagents/researcher/agent.ts"))
    ).rejects.toThrow();
    const custom = await project(true);
    await writeFile(custom.file, 'export default {name: "custom"};');
    await expect(removeClonedResearch(custom.root)).rejects.toThrow(
      "was customized"
    );
    expect(await readFile(custom.file, "utf-8")).toContain('"custom"');
    expect(
      await Bun.file(
        join(custom.root, "tools/chatjs/deep-research/chatjs.json")
      ).exists()
    ).toBe(true);
  } finally {
    server.stop(true);
  }
});
