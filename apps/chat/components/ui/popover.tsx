"use client";
/* oxlint-disable import/no-namespace -- @radix-ui/react-popover import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as PopoverPrimitive from "@radix-ui/react-popover";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Popover: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Popover = ({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>): React.JSX.Element => (
  <PopoverPrimitive.Root data-slot="popover" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverTrigger: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PopoverTrigger = ({
  ...props
}: React.ComponentProps<
  typeof PopoverPrimitive.Trigger
>): React.JSX.Element => (
  <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PopoverContent = ({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<
  typeof PopoverPrimitive.Content
>): React.JSX.Element => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align={align}
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        className
      )}
      data-slot="popover-content"
      sideOffset={sideOffset}
      {...props}
    />
  </PopoverPrimitive.Portal>
);
/* oxlint-enable no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverAnchor: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PopoverAnchor = ({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>): React.JSX.Element => (
  <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
