import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth -- ChatLoadingShell: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries. */

export const ChatLoadingShell = (): React.JSX.Element => (
  <div className="bg-background flex h-dvh w-full flex-col">
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 px-2 md:px-2">
      <Skeleton className="size-8 shrink-0 md:hidden" />
      <Skeleton className="h-5 w-36" />
      <div className="ml-auto flex items-center gap-2">
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-6">
      <Skeleton className="h-16 w-3/4 max-w-xl rounded-2xl" />
      <Skeleton className="ml-auto h-14 w-2/3 max-w-lg rounded-2xl" />
      <Skeleton className="h-20 w-4/5 max-w-2xl rounded-2xl" />
    </div>
    <div className="shrink-0 p-4">
      <Skeleton className="mx-auto h-14 w-full max-w-3xl rounded-2xl" />
    </div>
  </div>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth */
