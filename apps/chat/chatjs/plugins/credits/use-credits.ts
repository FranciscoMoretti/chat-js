"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export const useGetCredits = (): {
  balanceCents: number | undefined;
  isError: boolean;
} => {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);
  const trpc = useTRPC();

  const { data: creditsData, isError } = useQuery({
    ...trpc.credits.getAvailableCredits.queryOptions(),
    enabled: isAuthenticated,
    meta: { refreshOnTurnEnd: true },
  });

  return {
    balanceCents: creditsData?.balanceCents,
    isError,
  };
};
