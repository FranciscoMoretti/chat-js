import { Hint } from "@/components/hint";
import type { ComponentProps, JSX as ReactJSX } from "react";

import { PanelLeft } from "lucide-react";

import type { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";

import { Button } from "./ui/button";

export const SidebarToggle = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof SidebarTrigger>): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <Hint
      trigger={
        <Button
          aria-label="Toggle sidebar"
          {...props}
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) {
              toggleSidebar();
            }
          }}
          size="icon"
          variant="ghost"
        >
          <PanelLeft size={16} />
        </Button>
      }
      contentProps={{ align: "start" }}
    >
      Toggle Sidebar
    </Hint>
  );
};
