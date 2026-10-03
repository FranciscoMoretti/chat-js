import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";

/* oxlint-disable react/forbid-component-props --
 * react/forbid-component-props (#545): Loading uses className/style as established component styling interfaces; removing them changes the rendered contract.
 */
const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);
/* oxlint-enable react/forbid-component-props */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default Loading;
/* oxlint-enable import/no-default-export */
