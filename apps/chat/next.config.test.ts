import { afterEach, expect, test, vi } from "vitest";
import type { NextConfig } from "next";

type WorkerRewrites = Awaited<ReturnType<NonNullable<NextConfig["rewrites"]>>>;

vi.mock("eve/next", () => ({
  withEve: () => (): { rewrites: () => WorkerRewrites } => ({
    rewrites: (): WorkerRewrites => ({
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

const routes = async (): Promise<WorkerRewrites | undefined> => {
  const { default: configure } = await import("./next.config");
  const config = await configure("phase-production-build", {
    defaultConfig: {},
  });
  if (typeof config.rewrites !== "function") {
    throw new TypeError("Expected the EVE routing fixture to supply rewrites");
  }
  return await config.rewrites();
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
