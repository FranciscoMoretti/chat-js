"use client";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppRouter } from "@/trpc/routers/_app";
import type { Project } from "@/lib/db/schema";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/react";

interface ProjectRenameSnapshot {
  previous?: Project[];
  detail?: Project | null;
}

export const useRenameProject = (): UseMutationResult<
  inferRouterOutputs<AppRouter>["project"]["update"],
  TRPCClientErrorLike<AppRouter>,
  inferRouterInputs<AppRouter>["project"]["update"],
  ProjectRenameSnapshot
> => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.project.update.mutationOptions<ProjectRenameSnapshot>({
      onError: (
        _error: unknown,
        _variables,
        context: Readonly<ProjectRenameSnapshot> | undefined
      ) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.project.list.queryKey(),
            context.previous
          );
        }
        if (context?.detail) {
          queryClient.setQueryData(
            trpc.project.getById.queryKey({ id: _variables.id }),
            context.detail
          );
        }
        toast.error("Failed to rename project");
      },
      onMutate: async (variables) => {
        const listKey = trpc.project.list.queryKey();
        const detailKey = trpc.project.getById.queryKey({ id: variables.id });
        await Promise.all([
          queryClient.cancelQueries({ queryKey: listKey }),
          queryClient.cancelQueries({ queryKey: detailKey }),
        ]);
        const detail = queryClient.getQueryData<Project | null>(detailKey);
        const previous = queryClient.getQueryData<Project[]>(listKey);
        const nextName =
          typeof variables.updates.name === "string"
            ? variables.updates.name
            : undefined;
        if (typeof nextName === "string" && nextName !== "") {
          queryClient.setQueryData<Project | null>(detailKey, (old) => {
            if (old) {
              return { ...old, name: nextName };
            }
            return old;
          });
          queryClient.setQueryData<Project[] | undefined>(listKey, (old) =>
            old?.map((project: ReadonlyNativeSurface<Project>) => {
              if (project.id === variables.id) {
                return { ...project, name: nextName };
              }
              return project;
            })
          );
        }
        return { detail, previous };
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.project.pathKey(),
        });
      },
      onSuccess: () => toast.success("Project renamed"),
    })
  );
};
