"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export const useGetCredits = () => {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
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
