import { beforeAll, expect, mock, test } from "bun:test";
import path from "node:path";
import { Script } from "node:vm";

const branding = {
  appName: "ChatJS",
  appPrefix: "chatjs",
  appUrl: "https://chat.example.test",
  auth: {
    callbackPath: "/electron/callback",
    clientId: "chatjs-desktop",
    cookiePrefix: "chatjs",
  },
};
const devUrl = "http://localhost:3000";
const overrideUrl = "https://override.example.test";
let startup: Script;

beforeAll(async () => {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dir, "lib/auth-client.ts")],
    external: [
      "@better-auth/electron/client",
      "@better-auth/electron/storage",
      "better-auth/client",
      "electron",
    ],
    plugins: [
      {
        name: "startup-test-branding",
        setup(build) {
          build.onResolve(
            { filter: /^\.\.\/branding\.json$/u },
            ({ path: request }) => ({ external: true, path: request })
          );
        },
      },
    ],
    format: "cjs",
    target: "node",
  });
  expect(result.success).toBe(true);
  startup = new Script(await result.outputs[0].text());
});

test.each([
  {
    name: "packaged launch without NODE_ENV uses the branded host",
    isPackaged: true,
    nodeEnv: undefined,
    configuredUrl: undefined,
    expectedUrl: branding.appUrl,
  },
  {
    name: "packaged launch with an empty override uses the branded host",
    isPackaged: true,
    nodeEnv: "development",
    configuredUrl: "",
    expectedUrl: branding.appUrl,
  },
  {
    name: "unpackaged launch with production NODE_ENV uses localhost",
    isPackaged: false,
    nodeEnv: "production",
    configuredUrl: undefined,
    expectedUrl: devUrl,
  },
  {
    name: "packaged launch honors the configured URL",
    isPackaged: true,
    nodeEnv: "development",
    configuredUrl: overrideUrl,
    expectedUrl: overrideUrl,
  },
  {
    name: "unpackaged launch honors the configured URL",
    isPackaged: false,
    nodeEnv: "production",
    configuredUrl: overrideUrl,
    expectedUrl: overrideUrl,
  },
])("$name", ({ isPackaged, nodeEnv, configuredUrl, expectedUrl }) => {
  const protectedStorage = { getItem: mock(() => null), setItem: mock() };
  const storage = mock(() => protectedStorage);
  const safeStorage = { isEncryptionAvailable: () => true };
  const createAuthClient = mock(
    (_options: Readonly<{ baseURL: string }>) => ({})
  );
  const electronClient = mock(
    (
      options: Readonly<{
        signInURL: string;
        storage: Readonly<{
          getItem: (key: string) => unknown;
          setItem: (key: string, value: unknown) => void;
        }>;
      }>
    ) => options
  );
  const modules = new Map<string, unknown>([
    ["../branding.json", branding],
    ["better-auth/client", { createAuthClient }],
    ["@better-auth/electron/client", { electronClient }],
    ["@better-auth/electron/storage", { storage }],
    ["electron", { app: { isPackaged }, safeStorage }],
  ]);

  startup.runInNewContext({
    module: { exports: {} },
    process: { env: { ELECTRON_APP_URL: configuredUrl, NODE_ENV: nodeEnv } },
    require: (request: string) => {
      if (!modules.has(request)) {
        throw new Error(`Unexpected startup dependency: ${request}`);
      }
      return modules.get(request);
    },
  });

  const [[{ baseURL }]] = createAuthClient.mock.calls;
  const [[plugin]] = electronClient.mock.calls;
  expect(baseURL).toBe(expectedUrl);
  expect(plugin.signInURL).toBe(`${expectedUrl}/device-login`);
  expect(safeStorage.isEncryptionAvailable()).toBe(isPackaged);
  if (isPackaged) {
    expect(storage).toHaveBeenCalledTimes(1);
    expect(plugin.storage).toBe(protectedStorage);
  } else {
    expect(storage).not.toHaveBeenCalled();
    expect(plugin.storage.getItem("session")).toBeNull();
    plugin.storage.setItem("session", "local-session");
    expect(plugin.storage.getItem("session")).toBe("local-session");
  }
});
