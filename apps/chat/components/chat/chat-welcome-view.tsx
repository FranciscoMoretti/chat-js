import React from "react";

import type { ReadonlyReactNode } from "../../lib/readonly-react-node";
import { cn } from "cn";

const WelcomeMessage = (): React.JSX.Element => (
  <div className="pointer-events-none text-center">
    <h1 className="text-foreground text-2xl font-normal sm:text-3xl">
      How can I help you today?
    </h1>
  </div>
);

export const ChatWelcomeView = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col justify-end md:justify-center",
      className
    )}
  >
    <div className="mx-auto w-full p-2 pb-4 md:max-w-3xl @[500px]:px-4 @[500px]:pb-6">
      <div className="mb-4 md:mb-6">
        <WelcomeMessage />
      </div>
      {children}
    </div>
  </div>
);
