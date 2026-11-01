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
    render={<InternalLink {...props} className={linkClassName} />}
  >
    {children}
  </SidebarMenuButton>
);

export const MenuLink = <T extends string>({
  children,
  ...props
}: InternalLinkProps<T>) => (
  <DropdownMenuItem render={<InternalLink {...props} />}>
    {children}
  </DropdownMenuItem>
);

export const BreadcrumbNavigationLink = <T extends string>({
  children,
  ...props
}: InternalLinkProps<T>) => (
  <BreadcrumbLink render={<InternalLink {...props} />}>
    {children}
  </BreadcrumbLink>
);
