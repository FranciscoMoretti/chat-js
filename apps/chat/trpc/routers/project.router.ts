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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ id: z.string().uuid() }))
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
        id: z.string().uuid(),
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
        id: z.string().uuid(),
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
