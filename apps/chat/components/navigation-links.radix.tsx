"use client";
import { InternalLink } from "./internal-link";
import type { InternalLinkProps } from "./internal-link";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BreadcrumbLink } from "@/components/ui/breadcrumb";

type SidebarLinkProps<T extends string> = InternalLinkProps<T> & {
  readonly linkClassName?: string;
  readonly isActive?: boolean;
  readonly tooltip?: string;
};

export const SidebarLink = <T extends string>({
  children,
  className,
  linkClassName,
  isActive,
  tooltip,
  ...props
}: SidebarLinkProps<T>) => (
  <SidebarMenuButton
    className={className}
    isActive={isActive}
    tooltip={tooltip}
    asChild
  >
    <InternalLink {...props} className={linkClassName}>
      {children}
    </InternalLink>
  </SidebarMenuButton>
);

export const MenuLink = <T extends string>({
  children,
  ...props
}: InternalLinkProps<T>) => (
  <DropdownMenuItem asChild>
    <InternalLink {...props}>{children}</InternalLink>
  </DropdownMenuItem>
);

export const BreadcrumbNavigationLink = <T extends string>({
  children,
  ...props
}: InternalLinkProps<T>) => (
  <BreadcrumbLink asChild>
    <InternalLink {...props}>{children}</InternalLink>
  </BreadcrumbLink>
);
