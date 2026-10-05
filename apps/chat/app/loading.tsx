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

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default Loading;
/* oxlint-enable import/no-default-export */
