import {
  PROJECT_COLOR_NAMES,
  PROJECT_ICONS,
} from "@/chatjs/plugins/projects/project-icons";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  assignEveConversationProject,
  getEveConversationProject,
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
} from "@/chatjs/plugins/projects/db/project-queries";

import { generateUUID } from "@/lib/id";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

export const projectRouter = createTRPCRouter({
  assign: protectedProcedure
    .input(
      z.object({ conversationId: z.uuid(), projectId: z.uuid().nullable() })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          projectId: string | null;
        }>;
      }) => {
        const assigned = await assignEveConversationProject(
          ctx.user.id,
          input.conversationId,
          input.projectId
        );
        if (!assigned) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation or project not found.",
          });
        }
        return assigned;
      }
    ),

  forChat: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(
      async ({ ctx, input }) =>
        await getEveConversationProject(ctx.user.id, input.id)
    ),
  create: protectedProcedure
    .input(
      z.object({
        icon: z.enum(PROJECT_ICONS).optional(),
        iconColor: z.enum(PROJECT_COLOR_NAMES).optional(),
        instructions: z.string().default(""),
        name: z.string().nonempty(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          instructions: string;
          name: string;
          icon?:
            | "code"
            | "folder"
            | "briefcase"
            | "book"
            | "dollar-sign"
            | "graduation-cap"
            | "heart"
            | "home"
            | "lightbulb"
            | "music"
            | "pencil"
            | "plane"
            | "shopping-cart"
            | "star"
            | "target"
            | "users"
            | "zap"
            | "coffee"
            | "camera"
            | "globe"
            | "flask"
            | "chart-bar"
            | "calendar"
            | "clipboard"
            | "rocket"
            | undefined;
          iconColor?:
            | "gray"
            | "red"
            | "orange"
            | "yellow"
            | "green"
            | "cyan"
            | "blue"
            | "purple"
            | "pink"
            | undefined;
        }>;
      }) => {
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
      }
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{ id: string }>;
      }) => {
        const project = await getProjectById({ id: input.id });
        if (project === undefined) {
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
      }
    ),

  list: protectedProcedure.query(
    async ({
      ctx,
    }: {
      readonly ctx: { readonly user: { readonly id: string } };
    }) => {
      const projects = await getProjectsByUserId({ userId: ctx.user.id });
      return projects;
    }
  ),

  remove: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{ id: string }>;
      }) => {
        const project = await getProjectById({ id: input.id });
        if (project === undefined) {
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
      }
    ),

  setInstructions: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        instructions: z.string(),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          id: string;
          instructions: string;
        }>;
      }) => {
        const project = await getProjectById({ id: input.id });
        if (project === undefined) {
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
      }
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.uuid(),
        updates: z.object({
          icon: z.enum(PROJECT_ICONS).optional(),
          iconColor: z.enum(PROJECT_COLOR_NAMES).optional(),
          instructions: z.string().optional(),
          name: z.string().nonempty().optional(),
        }),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          id: string;
          updates: {
            icon?:
              | "code"
              | "folder"
              | "briefcase"
              | "book"
              | "dollar-sign"
              | "graduation-cap"
              | "heart"
              | "home"
              | "lightbulb"
              | "music"
              | "pencil"
              | "plane"
              | "shopping-cart"
              | "star"
              | "target"
              | "users"
              | "zap"
              | "coffee"
              | "camera"
              | "globe"
              | "flask"
              | "chart-bar"
              | "calendar"
              | "clipboard"
              | "rocket"
              | undefined;
            iconColor?:
              | "gray"
              | "red"
              | "orange"
              | "yellow"
              | "green"
              | "cyan"
              | "blue"
              | "purple"
              | "pink"
              | undefined;
            instructions?: string | undefined;
            name?: string | undefined;
          };
        }>;
      }) => {
        const project = await getProjectById({ id: input.id });
        if (project === undefined) {
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
      }
    ),
});
