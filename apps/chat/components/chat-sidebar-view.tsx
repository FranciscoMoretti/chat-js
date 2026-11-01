import type { ComponentType, ReactNode } from "react";

type SidebarSurface = ComponentType<{
  children?: ReactNode;
  className?: string;
}>;

/** Shared sidebar structure; navigation, history and account content are slots. */
export const ChatSidebarView = ({
  header,
  children,
  footer,
  direction = "ltr",
  primitives,
}: {
  readonly header: ReactNode;
  readonly children: ReactNode;
  readonly footer: ReactNode;
  readonly direction?: "ltr" | "rtl";
  readonly primitives: {
    Sidebar: ComponentType<{
      children?: ReactNode;
      className?: string;
      side: "left" | "right";
      dir: "ltr" | "rtl";
      collapsible: "icon";
    }>;
    SidebarContent: SidebarSurface;
    SidebarFooter: SidebarSurface;
    SidebarHeader: SidebarSurface;
    SidebarSeparator: SidebarSurface;
    ScrollArea: SidebarSurface;
  };
}) => (
  <primitives.Sidebar
    className="grid max-h-dvh grid-rows-[auto_1fr_auto] border-x-0"
    side={direction === "rtl" ? "right" : "left"}
    dir={direction}
    collapsible="icon"
  >
    <primitives.SidebarHeader className="shrink-0">
      {header}
    </primitives.SidebarHeader>
    <primitives.SidebarSeparator />
    <primitives.ScrollArea className="relative flex-1 overflow-y-auto">
      <primitives.SidebarContent className="max-w-(--sidebar-width) pr-2 group-data-[collapsible=icon]:hidden">
        {children}
      </primitives.SidebarContent>
    </primitives.ScrollArea>
    <primitives.SidebarSeparator />
    <primitives.SidebarFooter>{footer}</primitives.SidebarFooter>
  </primitives.Sidebar>
);
