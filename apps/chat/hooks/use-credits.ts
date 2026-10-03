"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useGetCredits: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including session?.user); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
