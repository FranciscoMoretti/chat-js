import { TRPCError } from "@trpc/server";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
} from "@/lib/db/queries";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { PROJECT_COLOR_NAMES, PROJECT_ICONS } from "@/lib/project-icons";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
import { generateUUID } from "@/lib/utils";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (projectRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve projectRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- * no-magic-numbers (#517): projectRouter uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): projectRouter intentionally keeps the existing falsy-value behavior of project; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): projectRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
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
    .mutation(
      // oxlint-disable-next-line eslint/max-lines-per-function -- Readonly parameter declarations add type-only lines to this existing cohesive operation; preserve its ordered runtime behavior.
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
          name: z.string().min(1).optional(),
        }),
      })
    )
    .mutation(
      // oxlint-disable-next-line eslint/max-lines-per-function -- Readonly parameter declarations add type-only lines to this existing cohesive operation; preserve its ordered runtime behavior.
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
      }
    ),
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
