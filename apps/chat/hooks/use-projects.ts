"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Project } from "@/lib/db/schema";
import { useTRPC } from "@/trpc/react";

export const useRenameProject = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.project.update.mutationOptions<{
      previous?: Project[];
      detail?: Project | null;
    }>({
      onError: (_error, _variables, context) => {
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
        if (nextName) {
          queryClient.setQueryData<Project | null>(detailKey, (old) =>
            old ? { ...old, name: nextName } : old
          );
          queryClient.setQueryData<Project[] | undefined>(listKey, (old) =>
            old?.map((project) =>
              project.id === variables.id
                ? { ...project, name: nextName }
                : project
            )
          );
        }
        return { detail, previous };
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.project.pathKey() }),
      onSuccess: () => toast.success("Project renamed"),
    })
  );
};
