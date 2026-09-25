import { afterEach, expect, test, vi } from "vitest";

vi.mock("eve/next", () => ({
  withEve: () => () => ({
    rewrites: () => ({
      beforeFiles: [
        {
          destination: "http://worker/eve/v1/:path*",
          source: "/eve/chat/v1/:path*",
        },
      ],
    }),
  }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const routes = async () => {
  const { default: configure } = await import("./next.config");
  const config = await configure("phase-production-build", {
    defaultConfig: {},
  });
  return await config.rewrites();
};

test("local registered alias resolves before named agent rewrites", async () => {
  vi.stubEnv("CHATJS_GUEST_ONLY", "false");
  vi.stubEnv("VERCEL_URL", "");
  const result = await routes();
  expect(result.beforeFiles[0]).toEqual({
    destination: "/eve/chat/v1/:path*",
    source: "/eve/v1/:path*",
  });
});

test("Vercel registered alias re-enters platform routing for the named chat service", async () => {
  vi.stubEnv("CHATJS_GUEST_ONLY", "false");
  vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
  const result = await routes();
  expect(result.beforeFiles[0]).toEqual({
    destination: "https://deployment.vercel.app/eve/chat/v1/:path*",
    source: "/eve/v1/:path*",
  });
});

test("guest-only deployment does not install a registered alias", async () => {
  vi.stubEnv("CHATJS_GUEST_ONLY", "true");
  const result = await routes();
  expect(result.beforeFiles).not.toContainEqual(
    expect.objectContaining({ source: "/eve/v1/:path*" })
  );
});
