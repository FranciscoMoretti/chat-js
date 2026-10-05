import React from "react";

import { Skeleton } from "@/components/ui/skeleton";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ChatLoadingShell); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-max-depth -- ChatLoadingShell: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries. */

export const ChatLoadingShell = (): React.JSX.Element => (
  <div className="bg-background flex h-dvh w-full flex-col">
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 px-2 md:px-2">
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-8 shrink-0 md:hidden"
      />
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-5 w-36"
      />
      <div className="ml-auto flex items-center gap-2">
        <Skeleton
          // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-8"
        />
        <Skeleton
          // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-8"
        />
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-6">
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-16 w-3/4 max-w-xl rounded-2xl"
      />
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="ml-auto h-14 w-2/3 max-w-lg rounded-2xl"
      />
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-20 w-4/5 max-w-2xl rounded-2xl"
      />
    </div>
    <div className="shrink-0 p-4">
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="mx-auto h-14 w-full max-w-3xl rounded-2xl"
      />
    </div>
  </div>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth */
