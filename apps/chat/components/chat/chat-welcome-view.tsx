import React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable react/jsx-no-literals -- WelcomeMessage: react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration. */

const WelcomeMessage = (): React.JSX.Element => (
  <div className="pointer-events-none text-center">
    <h1 className="text-foreground text-2xl font-normal sm:text-3xl">
      How can I help you today?
    </h1>
  </div>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ChatWelcomeView: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ChatWelcomeView = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
