"use client";

import { LogIn } from "lucide-react";
import { InternalLink } from "@/components/internal-link";
import { SidebarHistory } from "@/components/sidebar-history";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/providers/session-provider";

export function AppSidebarHistoryConditional() {
  const { open, openMobile } = useSidebar();
  const { data: session, isPending } = useSession();

  if (!(open || openMobile)) {
    return null;
  }

  if (isPending) {
    return (
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2 px-2">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-5/6" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-7 w-full" />
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (!session?.user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyTitle>Sign In</EmptyTitle>
              <EmptyDescription>
                Sign in to save your chat history
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm" variant="outline">
                <InternalLink href="/login">
                  <LogIn />
                  Sign In
                </InternalLink>
              </Button>
            </EmptyContent>
          </Empty>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return <SidebarHistory />;
}
