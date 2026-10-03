import React from "react";

import { WithSkeleton } from "@/components/with-skeleton";
/* oxlint-disable react/forbid-component-props -- Loading: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API. */

const Loading = (): React.JSX.Element => (
  <WithSkeleton className="h-full w-full" isLoading>
    <div className="flex h-dvh w-full" />
  </WithSkeleton>
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-disable import/no-default-export -- loading route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default Loading;
/* oxlint-enable import/no-default-export */
