import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

export default Loading;
