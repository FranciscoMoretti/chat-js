import { afterEach, expect, test, vi } from "vitest";

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/next")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
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
/* oxlint-enable typescript/explicit-function-return-type */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve routes's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep routes's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const routes = async () => {
  const { default: configure } = await import("./next.config");
  const config = await configure("phase-production-build", {
    defaultConfig: {},
  });
  return await config.rewrites?.();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

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
