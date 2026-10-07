import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

const Loading = (): React.JSX.Element => (
  <WithSkeleton
    // oxlint-disable-next-line react/forbid-component-props -- WithSkeleton accepts className in its styling contract; preserve this caller's layout and appearance.
    className="h-full w-full"
    isLoading
  >
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this loading boundary module and create-component-tree selects its default component Loading.
export default Loading;
