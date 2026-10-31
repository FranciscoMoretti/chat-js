"use client";

import { Hint } from "@/components/hint";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** A named message action shared by the toolbar and installed feedback controls. */
export const MessageAction = ({
  tooltip,
  children,
  ...props
}: ComponentProps<typeof Button> & { readonly tooltip: string }) => (
  <Hint
    trigger={
      <Button
        aria-label={tooltip}
        size="icon-sm"
        type="button"
        variant="ghost"
        {...props}
      >
        {children}
      </Button>
    }
  >
    {tooltip}
  </Hint>
);
