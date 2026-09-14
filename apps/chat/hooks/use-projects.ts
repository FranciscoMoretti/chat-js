"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Project } from "@/lib/db/schema";
import { useTRPC } from "@/trpc/react";

export const useRenameProject = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(
    trpc.project.update.mutationOptions<{ previous?: Project[] }>({
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          queryClient.setQueryData(
            trpc.project.list.queryKey(),
            context.previous
          );
        }
        toast.error("Failed to rename project");
      },
      onMutate: async (variables) => {
        const listKey = trpc.project.list.queryKey();
        await queryClient.cancelQueries({ queryKey: listKey });
        const previous = queryClient.getQueryData<Project[]>(listKey);
        const nextName =
          typeof variables.updates.name === "string"
            ? variables.updates.name
            : undefined;
        if (nextName) {
          queryClient.setQueryData<Project[] | undefined>(listKey, (old) =>
            old?.map((project) =>
              project.id === variables.id
                ? { ...project, name: nextName }
                : project
            )
          );
        }
        return { previous };
      },
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: trpc.project.pathKey() }),
      onSuccess: () => toast.success("Project renamed"),
    })
  );
};
