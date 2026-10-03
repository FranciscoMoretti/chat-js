import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
} from "@/lib/db/queries";
import { PROJECT_COLOR_NAMES, PROJECT_ICONS } from "@/lib/project-icons";
import { generateUUID } from "@/lib/utils";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls  --
 * import/no-named-export (#527): Preserve the named projectRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): projectRouter remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-magic-numbers (#517): projectRouter uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): projectRouter sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): projectRouter accepts { ctx, input }; { ctx }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): projectRouter intentionally keeps the existing falsy-value behavior of project; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): projectRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
export const projectRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        icon: z.enum(PROJECT_ICONS).optional(),
        iconColor: z.enum(PROJECT_COLOR_NAMES).optional(),
        instructions: z.string().default(""),
        name: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = generateUUID();
      await createProject({
        icon: input.icon,
        iconColor: input.iconColor,
        id,
        instructions: input.instructions,
        name: input.name,
        userId: ctx.user.id,
      });
      return { id };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById({ id: input.id });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }
      return project;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await getProjectsByUserId({ userId: ctx.user.id });
    return projects;
  }),

  remove: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById({ id: input.id });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }
      await deleteProject({ id: input.id });
      return { success: true };
    }),

  setInstructions: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        instructions: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById({ id: input.id });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }
      await updateProject({
        id: input.id,
        updates: { instructions: input.instructions },
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        updates: z.object({
          icon: z.enum(PROJECT_ICONS).optional(),
          iconColor: z.enum(PROJECT_COLOR_NAMES).optional(),
          instructions: z.string().optional(),
          name: z.string().min(1).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await getProjectById({ id: input.id });
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      if (project.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Project not found",
        });
      }
      await updateProject({ id: input.id, updates: input.updates });
      return { success: true };
    }),
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
