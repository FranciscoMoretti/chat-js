import { initTRPC } from "@trpc/server";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { expect, expectTypeOf, test } from "vitest";
import { z } from "zod";
import { mergePluginRouters } from "./plugin";

test("composed plugin routers preserve tRPC procedure types when a plugin has no routers", () => {
  const trpc = initTRPC.create();
  const project = trpc.router({
    getById: trpc.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => ({ projectId: input.id })),
  });
  const search = trpc.router({
    results: trpc.procedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => [input.query]),
  });

  const routers = mergePluginRouters([
    { id: "projects", routers: { project } },
    { id: "policy" },
    { id: "search", routers: { search } },
  ]);
  const appRouter = trpc.router(routers);
  const emptyRouter = trpc.router(mergePluginRouters([{ id: "policy" }]));
  type Inputs = inferRouterInputs<typeof appRouter>;
  type Outputs = inferRouterOutputs<typeof appRouter>;

  expect(Object.keys(routers)).toEqual(["project", "search"]);
  expect(emptyRouter).toBeDefined();
  expectTypeOf<keyof Inputs>().toEqualTypeOf<"project" | "search">();
  expectTypeOf<Inputs["project"]>().toEqualTypeOf<
    inferRouterInputs<typeof project>
  >();
  expectTypeOf<Outputs["project"]>().toEqualTypeOf<
    inferRouterOutputs<typeof project>
  >();
  expectTypeOf<Inputs["search"]>().toEqualTypeOf<
    inferRouterInputs<typeof search>
  >();
  expectTypeOf<Outputs["search"]>().toEqualTypeOf<
    inferRouterOutputs<typeof search>
  >();
});
