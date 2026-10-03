import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

/* oxlint-disable import/no-default-export -- loading route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default Loading;
/* oxlint-enable import/no-default-export */
