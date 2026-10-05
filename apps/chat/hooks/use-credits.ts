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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isAuthenticated = Boolean(session?.user);
  const trpc = useTRPC();

  const { data: creditsData, isLoading: isLoadingCredits } = useQuery({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing trpc.credits.getAvailableCredits.queryOptions() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...trpc.credits.getAvailableCredits.queryOptions(),
    enabled: isAuthenticated,
  });

  return {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading credits from creditsData; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    credits: creditsData?.credits,
    isLoadingCredits: isAuthenticated && isLoadingCredits,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
