import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default Loading;
/* oxlint-enable import/no-default-export */
