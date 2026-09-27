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
  return await config.rewrites?.();
};

test("keeps EVE named-agent routing without an external deployment alias", async () => {
  vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
  const result = await routes();
  expect(result).toEqual({
    beforeFiles: [
      {
        destination: "http://worker/eve/v1/:path*",
        source: "/eve/chat/v1/:path*",
      },
    ],
  });
});
