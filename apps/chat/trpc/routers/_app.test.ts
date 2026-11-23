import { initTRPC } from "@trpc/server";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { afterEach, expect, expectTypeOf, test, vi } from "vitest";
import { z } from "zod";

const trpc = initTRPC.create();
const echo = trpc.procedure.input(z.string()).query(({ input }) => ({ input }));
const core = trpc.router({ echo });

vi.mock("@/trpc/init", () => ({
  createCallerFactory: trpc.createCallerFactory,
  createTRPCRouter: trpc.router,
  mergeRouters: trpc.mergeRouters,
}));
vi.mock("./eve.router", () => ({ eveRouter: core }));

afterEach(() => {
  vi.doUnmock("@/integrations/routers");
  vi.resetModules();
});

test.each(["eve", "__proto__"])(
  "rejects the plugin namespace %s at the app root",
  async (key) => {
    vi.doMock("@/integrations/routers", () => ({
      routers: [trpc.router({ [key]: { echo } })],
    }));
    await expect(import("./_app")).rejects.toThrow(key);
  }
);

test("app-owned and plugin router namespaces cannot shadow each other", async () => {
  vi.doMock("@/integrations/routers", () => ({
    routers: [
      trpc.router({ health: { check: echo } }),
      trpc.router({ health: { status: echo } }),
    ],
  }));
  await expect(import("./_app")).rejects.toThrow("Duplicate key health");
});

test("native composition preserves procedure types and handles an empty selection", async () => {
  const app = trpc.mergeRouters(
    trpc.router({ eve: core }),
    trpc.router({ notes: { echo } })
  );
  expectTypeOf<
    inferRouterInputs<typeof app>["notes"]["echo"]
  >().toEqualTypeOf<string>();
  expectTypeOf<
    inferRouterOutputs<typeof app>["notes"]["echo"]
  >().toEqualTypeOf<{ input: string }>();
  vi.doMock("@/integrations/routers", () => ({ routers: [] }));
  const { appRouter } = await import("./_app");
  expect(Object.keys(appRouter._def.record)).toEqual(["eve"]);
});
