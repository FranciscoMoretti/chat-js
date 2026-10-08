import { PROJECT_COLOR_NAMES, PROJECT_ICONS } from "@/lib/project-icons";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between zod and @/lib/db/queries still needs a supported server equivalence check; preserve the existing order meanwhile.
import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
} from "@/lib/db/queries";

import { generateUUID } from "@/lib/utils";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/lib/utils and @/trpc/init still needs a supported server equivalence check; preserve the existing order meanwhile.
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (projectRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve projectRouter's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable unicorn/max-nested-calls -- * unicorn/max-nested-calls (#568): projectRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
export const projectRouter = createTRPCRouter({
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- getProjectById destructures a possibly empty result array but infers a non-nullable object; retain the missing-project guard until its owned return contract includes undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- getProjectById destructures a possibly empty result array but infers a non-nullable object; retain the missing-project guard until its owned return contract includes undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- getProjectById destructures a possibly empty result array but infers a non-nullable object; retain the missing-project guard until its owned return contract includes undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
          name: z.string().nonempty().optional(),
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- getProjectById destructures a possibly empty result array but infers a non-nullable object; retain the missing-project guard until its owned return contract includes undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
/* oxlint-enable unicorn/max-nested-calls */
