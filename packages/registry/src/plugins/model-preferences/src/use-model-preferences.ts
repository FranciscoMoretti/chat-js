"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { applyModelPreferences } from "./apply-model-preferences";

export const useModelPreferences = (
  defaults: ReadonlySet<string>
): ReadonlySet<string> => {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const authenticated = Boolean(session?.user);
  const { data: preferences } = useQuery({
    ...trpc.modelPreferences.getModelPreferences.queryOptions(),
    enabled: authenticated,
  });
  return useMemo(
    () =>
      authenticated && preferences
        ? applyModelPreferences(defaults, preferences)
        : defaults,
    [authenticated, defaults, preferences]
  );
};
