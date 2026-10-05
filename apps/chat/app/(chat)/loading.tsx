import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this loading boundary module and create-component-tree selects its default component Loading.
export default Loading;
