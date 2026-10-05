"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useGetCredits); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const useGetCredits = (): {
  credits: number | undefined;
  isLoadingCredits: boolean;
} => {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const trpc = useTRPC();

  const { data: creditsData, isLoading: isLoadingCredits } = useQuery({
    ...trpc.credits.getAvailableCredits.queryOptions(),
    enabled: isAuthenticated,
  });

  return {
    credits: creditsData?.credits,
    isLoadingCredits: isAuthenticated && isLoadingCredits,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
