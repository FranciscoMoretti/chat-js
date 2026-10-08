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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve routes's awaited sequencing and rejected-Promise behavior. */
const routes = async (): Promise<WorkerRewrites | undefined> => {
  const { default: configure } = await import("./next.config");
  const config = await configure("phase-production-build", {
    defaultConfig: {},
  });
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling config.rewrites; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
  return await config.rewrites?.();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

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
/* oxlint-enable oxc/no-async-await */
