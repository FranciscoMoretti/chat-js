"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useGetCredits: ; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useGetCredits = () => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
