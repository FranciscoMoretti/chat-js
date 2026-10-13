import { expect, it } from "bun:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { BundlerInternals, webpack } from "@remotion/bundler";
import type { WebpackConfiguration } from "@remotion/bundler";

import { webpackOverride } from "../webpack";

const resolvePath = (specifier: string): string =>
  fileURLToPath(import.meta.resolve(specifier));

type Alias = NonNullable<NonNullable<WebpackConfiguration["resolve"]>["alias"]>;
const sourceDirectory = path.resolve(import.meta.dir, "../src");
const storyFile = path.join(sourceDirectory, "story.ts");
const indexFile = path.join(sourceDirectory, "index.tsx");
const peerAliases = {
  react: path.dirname(resolvePath("react/package.json")),
  "react-dom": path.dirname(resolvePath("react-dom/package.json")),
};

const aliasCases: { alias: Alias; name: string }[] = [
  {
    alias: {
      choice: ["/missing-webpack-alias", storyFile],
      duplicate: storyFile,
      exact$: storyFile,
      ignored: false,
      react: false,
      "react-dom": ["/missing-react-dom"],
      "react/jsx-runtime": resolvePath("react/jsx-runtime"),
      source: sourceDirectory,
    },
    name: "map",
  },
  {
    alias: [
      { alias: ["/missing-webpack-alias", storyFile], name: "choice" },
      { alias: storyFile, name: "duplicate" },
      { alias: indexFile, name: "duplicate" },
      { alias: storyFile, name: "exact", onlyModule: true },
      { alias: false, name: "ignored" },
      {
        alias: resolvePath("react/jsx-runtime"),
        name: "react/jsx-runtime",
      },
      { alias: false, name: "react" },
      { alias: "/missing-duplicate-react", name: "react" },
      { alias: ["/missing-react-dom"], name: "react-dom" },
      { alias: sourceDirectory, name: "source" },
    ],
    name: "array",
  },
];

// Webpack's native resolver validates configuration and executes its installed enhanced-resolve plugins.
const resolveWith = (alias: Alias) => {
  const compiler = webpack({ mode: "development", resolve: { alias } });
  const resolver = compiler.resolverFactory.get("normal", {
    useSyncFileSystemCalls: true,
  });
  return (request: string): string | false =>
    resolver.resolveSync({}, sourceDirectory, request);
};

const remotionOptions = {
  enableCaching: false,
  entry: indexFile,
  environment: "development",
  extraPlugins: [],
  outDir: null,
  poll: null,
  remotionRoot: path.resolve(import.meta.dir, ".."),
  userDefinedComponent: indexFile,
} satisfies Omit<
  Parameters<typeof BundlerInternals.webpackConfig>["0"],
  "bundlerOverride" | "webpackOverride"
>;

it("resolves an encoded file URL to its native path", async () => {
  const prefix = path.join(tmpdir(), "webpack-url-");
  const directory = await realpath(await mkdtemp(prefix));
  try {
    const file = path.join(directory, "module space # café.js");
    await writeFile(file, "module.exports = {};");
    const fileUrl = pathToFileURL(file).href;
    expect(resolvePath(fileUrl)).toBe(file);
    expect(await readFile(resolvePath(fileUrl), "utf-8")).toBe(
      "module.exports = {};"
    );
  } finally {
    await rm(directory, { recursive: true });
  }
});

it.each(aliasCases)(
  "preserves native resolution for $name aliases",
  async ({ alias }: Readonly<{ alias: Alias }>) => {
    const original = JSON.stringify(alias);
    const config = await webpackOverride({ resolve: { alias } });
    expect(JSON.stringify(alias)).toBe(original);
    expect(Array.isArray(config.resolve?.alias)).toBe(Array.isArray(alias));
    const resolve = resolveWith(config.resolve?.alias ?? {});
    const resolutions: readonly (readonly [string, string | false])[] = [
      ["choice", storyFile],
      ["duplicate", storyFile],
      ["exact", storyFile],
      ["ignored", false],
      ["source/story.ts", storyFile],
      ["react", resolvePath("react")],
      ["react-dom/client", resolvePath("react-dom/client")],
      ["react/jsx-runtime", resolvePath("react/jsx-runtime")],
    ];
    for (const [request, result] of resolutions) {
      expect(resolve(request)).toBe(result);
    }
    expect(() => resolve("exact/story")).toThrow();
  }
);

const exactPeerCases: {
  alias: Alias;
  name: string;
  expectedReact: string | false;
}[] = [
  {
    alias: { react$: false, "react/jsx-runtime": storyFile },
    expectedReact: false,
    name: "map with exact peer first",
  },
  {
    alias: [
      { alias: false, name: "react", onlyModule: true },
      { alias: storyFile, name: "react/jsx-runtime" },
    ],
    expectedReact: false,
    name: "array with exact peer first",
  },
  {
    alias: { react: false, react$: false },
    expectedReact: resolvePath("react"),
    name: "map with broad peer first",
  },
  {
    alias: [
      { alias: false, name: "react" },
      { alias: false, name: "react", onlyModule: true },
    ],
    expectedReact: resolvePath("react"),
    name: "array with broad peer first",
  },
];
it.each(exactPeerCases)(
  "preserves precedence for $name",
  async ({
    alias,
    expectedReact,
  }: Readonly<{ alias: Alias; expectedReact: string | false }>) => {
    const original = JSON.stringify(alias);
    const config = await webpackOverride({ resolve: { alias } });
    const resolve = resolveWith(config.resolve?.alias ?? {});
    expect(resolve("react")).toBe(expectedReact);
    expect(resolve("react/jsx-dev-runtime")).toBe(
      resolvePath("react/jsx-dev-runtime")
    );
    expect(resolve("react-dom/client")).toBe(resolvePath("react-dom/client"));
    expect(JSON.stringify(alias)).toBe(original);
  }
);

it.each([{}, { resolve: {} }])(
  "adds peers when alias configuration is absent",
  async (input: Readonly<{ resolve?: Readonly<Record<string, never>> }>) => {
    const config = await webpackOverride(input);
    expect(config.resolve?.alias).toEqual(peerAliases);
  }
);

it("preserves the installed Remotion alias map and other configuration fields", async () => {
  await BundlerInternals.webpackConfig({
    ...remotionOptions,
    bundlerOverride: (config) => config,
    webpackOverride: async (config: Readonly<WebpackConfiguration>) => {
      const actual = await webpackOverride(config);
      const alias = config.resolve?.alias;
      if (Array.isArray(alias)) {
        throw new TypeError(
          "The installed Remotion default alias contract changed"
        );
      }
      expect(actual).toEqual({
        ...config,
        resolve: {
          ...config.resolve,
          alias: { ...alias, ...peerAliases },
        },
      });
      expect(config.resolve?.alias).not.toHaveProperty(
        "react-dom",
        peerAliases["react-dom"]
      );
      return actual;
    },
  });
});

it("receives a valid array from a preceding native Remotion bundler override", async () => {
  const alias = aliasCases.find(
    (entry: Readonly<{ name: string }>) => entry.name === "array"
  )?.alias;
  await BundlerInternals.webpackConfig({
    ...remotionOptions,
    bundlerOverride: (config) => ({ ...config, resolve: { alias } }),
    webpackOverride: async (config: Readonly<WebpackConfiguration>) => {
      expect(config.resolve?.alias).toBe(alias);
      const actual = await webpackOverride(config);
      expect(resolveWith(actual.resolve?.alias ?? {})("duplicate")).toBe(
        storyFile
      );
      return actual;
    },
  });
});
