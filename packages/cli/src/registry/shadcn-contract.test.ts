import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { installItems, listTools, readItem, registryConfig } from "./shadcn";

const createConfigFixture = async (registry: unknown): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "shadcn-metadata-"));
  await writeFile(
    path.join(root, "components.json"),
    JSON.stringify({ registries: { "@chatjs": registry } })
  );
  return root;
};

const configuredRegistry = {
  headers: { "X-Registry-Contract": "preserved" },
  params: { version: "fixture" },
  url: "https://example.com/r/{name}.json",
};

test("registry config preserves the SDK object URL, parameters and headers contract", async () => {
  const root = await createConfigFixture(configuredRegistry);
  try {
    const source = await readFile(path.join(root, "components.json"), "utf-8");
    const config = await registryConfig(root);
    expect(config.registries["@chatjs"]).toEqual(configuredRegistry);
    expect(await readFile(path.join(root, "components.json"), "utf-8")).toBe(
      source
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

const metadataVariants: readonly unknown[] = [
  {},
  JSON.parse('{"chatjs":null}'),
  { chatjs: false },
  { chatjs: "tool" },
  { chatjs: [] },
  { chatjs: { extra: "keep", kind: "gateway" } },
  {
    chatjs: { extra: { arbitrary: ["preserved"] }, kind: "tool" },
    foreign: "keep",
  },
];
const items = metadataVariants.map((meta, index) => ({
  meta,
  name: `fixture-${index}`,
  type: "registry:item" as const,
}));
const selectedItem = {
  meta: {
    chatjs: { extra: { arbitrary: ["preserved"] }, kind: "tool" },
    foreign: "keep",
  },
  name: "fixture-6",
  type: "registry:item" as const,
};

const registryServer = (): Bun.Server<undefined> =>
  Bun.serve({
    fetch: () =>
      Response.json({
        homepage: "https://example.com",
        items,
        name: "fixture-registry",
      }),
    hostname: "127.0.0.1",
    port: 0,
  });

test("tool listing narrows only the ChatJS kind and retains arbitrary metadata", async () => {
  const server = registryServer();
  const root = await createConfigFixture(
    `http://127.0.0.1:${server.port}/{name}.json`
  );
  try {
    expect(await listTools(root)).toEqual([selectedItem]);
  } finally {
    await server.stop(true);
    await rm(root, { force: true, recursive: true });
  }
});

test("item parsing returns the SDK schema data without stripping third-party metadata", async () => {
  const server = Bun.serve({
    fetch: () => Response.json(selectedItem),
    hostname: "127.0.0.1",
    port: 0,
  });
  const root = await createConfigFixture(configuredRegistry);
  try {
    expect(
      await readItem(`http://127.0.0.1:${server.port}/item.json`, root)
    ).toEqual(selectedItem);
  } finally {
    await server.stop(true);
    await rm(root, { force: true, recursive: true });
  }
});

const installableItem = {
  files: [
    {
      content: "export const preserved = true;\n",
      path: "fixture.ts",
      target: "~/lib/fixture.ts",
      type: "registry:file",
    },
  ],
  name: "owned-work-list",
  type: "registry:item",
};

test("installing an immutable source selection leaves caller ownership intact", async () => {
  const server = Bun.serve({
    fetch: () => Response.json(installableItem),
    hostname: "127.0.0.1",
    port: 0,
  });
  const root = await mkdtemp(path.join(tmpdir(), "shadcn-immutable-install-"));
  const address = `http://127.0.0.1:${server.port}/fixture.json`;
  const sources = Object.freeze([address]);
  try {
    await installItems(sources, root);
    expect(await readFile(path.join(root, "lib/fixture.ts"), "utf-8")).toBe(
      "export const preserved = true;\n"
    );
    expect(sources).toEqual([address]);
  } finally {
    await server.stop(true);
    await rm(root, { force: true, recursive: true });
  }
});

const CHILD_EXIT_SUCCESS = 0;
const registryConfigInProcess = async (
  root: string,
  registryUrl: string
): Promise<unknown> => {
  const modulePath = path.join(import.meta.dir, "shadcn.ts");
  const script = `const { registryConfig } = await import(${JSON.stringify(modulePath)}); console.log(JSON.stringify(await registryConfig(${JSON.stringify(root)})));`;
  const child = Bun.spawn([process.execPath, "-e", script], {
    env: { CHATJS_REGISTRY_URL: registryUrl },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  expect({ exitCode, stderr }).toEqual({
    exitCode: CHILD_EXIT_SUCCESS,
    stderr: "",
  });
  return JSON.parse(stdout);
};

test("the process registry override remains the fallback and configured registry objects take priority", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "shadcn-registry-process-"));
  const processUrl = "https://example.com/process/{name}.json";
  try {
    expect(await registryConfigInProcess(root, processUrl)).toEqual({
      registries: { "@chatjs": processUrl },
    });
    await writeFile(
      path.join(root, "components.json"),
      JSON.stringify({ registries: { "@chatjs": configuredRegistry } })
    );
    expect(await registryConfigInProcess(root, processUrl)).toMatchObject({
      registries: { "@chatjs": configuredRegistry },
    });
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
