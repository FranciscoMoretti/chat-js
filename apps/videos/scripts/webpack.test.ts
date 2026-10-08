import { expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The URL portability regression creates, reads and removes a temporary filesystem fixture.
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The URL portability fixture uses the operating system's temporary directory.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules, sort-imports -- Native Webpack resolution tests use repository paths; preserve Oxfmt builtin ordering.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules, sort-imports -- Native file URLs need platform-aware path conversion; preserve Oxfmt's builtin import grouping.
import { fileURLToPath, pathToFileURL } from "node:url";

// oxlint-disable-next-line sort-imports -- Preserve the runtime import before the separate type binding, as formatted by Oxfmt.
import { BundlerInternals, webpack } from "@remotion/bundler";
import type { WebpackConfiguration } from "@remotion/bundler";

// oxlint-disable-next-line import/no-relative-parent-imports -- Exercise the same override imported by the still-rendering script.
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
const resolveWith = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native Webpack consumes mutable nested alias arrays; this test adapter passes them unchanged to that receiver.
  alias: Alias
) => {
  const compiler = webpack({ mode: "development", resolve: { alias } });
  const resolver = compiler.resolverFactory.get("normal", {
    useSyncFileSystemCalls: true,
  });
  return (request: string): string | false =>
    // oxlint-disable-next-line node/no-sync -- Exercise native resolution synchronously without starting compilation or rendering.
    resolver.resolveSync({}, sourceDirectory, request);
};

const remotionOptions = {
  enableCaching: false,
  entry: indexFile,
  environment: "development",
  extraPlugins: [],
  // oxlint-disable-next-line unicorn/no-null -- Remotion's native config-generation API requires null for an absent output directory.
  outDir: null,
  // oxlint-disable-next-line unicorn/no-null -- Remotion's native config-generation API requires null when polling is disabled.
  poll: null,
  remotionRoot: path.resolve(import.meta.dir, ".."),
  userDefinedComponent: indexFile,
} satisfies Omit<
  Parameters<typeof BundlerInternals.webpackConfig>["0"],
  "bundlerOverride" | "webpackOverride"
>;

/* oxlint-disable oxc/no-async-await -- Await native filesystem and Remotion promises so test failures reach Bun's runner; prefer-await-to-then rejects replacing the awaits with promise chains. */
/* oxlint-disable oxc/no-optional-chaining -- Inspect optional native Webpack resolve/alias results with their nullish guards. */
/* oxlint-disable oxc/no-rest-spread-properties -- Build native Remotion input/expected configuration by own-key composition; prefer-object-spread rejects Object.assign. */
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
  async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- These native alias fixtures retain mutable nested arrays for the Webpack configuration receiver.
    {
      alias,
    }: Readonly<{ alias: Alias }>
  ) => {
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
  async (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native alias fixtures are passed unchanged to the mutable nested Webpack configuration receiver.
    {
      alias,
      expectedReact,
    }: Readonly<{ alias: Alias; expectedReact: string | false }>
  ) => {
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
    webpackOverride: async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Remotion callbacks return native configuration including nested mutable arrays; a deep-readonly reader fails that return contract.
      config: Readonly<WebpackConfiguration>
    ) => {
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
    webpackOverride: async (
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Remotion callbacks return native configuration including nested mutable arrays; a deep-readonly reader fails that return contract.
      config: Readonly<WebpackConfiguration>
    ) => {
      expect(config.resolve?.alias).toBe(alias);
      const actual = await webpackOverride(config);
      expect(resolveWith(actual.resolve?.alias ?? {})("duplicate")).toBe(
        storyFile
      );
      return actual;
    },
  });
});

/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
