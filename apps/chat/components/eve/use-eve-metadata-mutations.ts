"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  optimisticEveMetadata,
  pendingEveMetadataMutations,
} from "@/lib/eve/optimistic-metadata";
import { useTRPC } from "@/trpc/react";

/** Logical metadata is shared by every branch detail and every loaded history. */
export const useEveMetadataMutations = () => {
  const cache = useQueryClient();
  const trpc = useTRPC();
  const settle = async () => {
    if (pendingEveMetadataMutations(cache) > 1) {
      return;
    }
    await Promise.all([
      cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
      cache.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
    ]);
  };
  const optimistic = (
    id: string,
    patch: { title?: string; isPinned?: boolean }
  ) =>
    optimisticEveMetadata(
      cache,
      trpc.eve.list.pathKey(),
      trpc.eve.get.pathKey(),
      id,
      patch
    );
  const rename = useMutation(
    trpc.eve.rename.mutationOptions<() => void>({
      meta: { eveMetadata: true },
      onError: (error, _input, rollback) => {
        rollback?.();
        toast.error(error.message);
      },
      onMutate: ({ id, title }) => optimistic(id, { title }),
      onSettled: settle,
      scope: { id: "eve-rename" },
    })
  );
  const pin = useMutation(
    trpc.eve.pin.mutationOptions<() => void>({
      meta: { eveMetadata: true },
      onError: (error, _input, rollback) => {
        rollback?.();
        toast.error(error.message);
      },
      onMutate: ({ id, isPinned }) => optimistic(id, { isPinned }),
      onSettled: settle,
      scope: { id: "eve-pin" },
    })
  );
  return { pin, rename };
};
