"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../chat/trpc/routers/_app";
import { TRPCProvider, useTRPC } from "../../../chat/trpc/context";
import { SessionContext } from "../../../chat/providers/session-context";
import { Plugins } from "../../../chat/chatjs/core/ui/slots";
import { feedbackClient } from "../../../chat/chatjs/plugins/feedback/client-plugin";
import { projectsClient } from "../../../chat/chatjs/plugins/projects/client-plugin";
import {
  createFixtureTransport,
  sampleConversation,
} from "./fixture-transport";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "./ui/base/sidebar";

const date = new Date("2026-01-01T00:00:00Z");
const session = {
  data: {
    user: {
      id: "preview-user",
      name: "Preview",
      email: "preview@example.invalid",
      emailVerified: true,
      createdAt: date,
      updatedAt: date,
      image: null,
    },
    session: {
      id: "preview-session",
      userId: "preview-user",
      token: "local-fixture",
      expiresAt: date,
      createdAt: date,
      updatedAt: date,
      ipAddress: null,
      userAgent: null,
    },
  },
  isPending: false,
};

export const PreviewPlugins = ({
  enabled,
  scenario,
  children,
}: {
  readonly enabled: readonly string[];
  readonly scenario: "ready" | "mutation-error";
  readonly children: ReactNode;
}) => {
  const runtime = useMemo(
    () => ({
      queryClient: new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: false } },
      }),
      client: createTRPCClient<AppRouter>({
        links: [createFixtureTransport(scenario).link],
      }),
    }),
    [scenario]
  );
  return (
    <QueryClientProvider key={scenario} client={runtime.queryClient}>
      <TRPCProvider
        queryClient={runtime.queryClient}
        trpcClient={runtime.client}
      >
        <SessionContext value={session}>
          <Plugins
            plugins={[feedbackClient, projectsClient].filter((plugin) =>
              enabled.includes(plugin.id)
            )}
          >
            {children}
          </Plugins>
        </SessionContext>
      </TRPCProvider>
    </QueryClientProvider>
  );
};

/** Sample history reads the same membership cache as the production breadcrumb/sidebar. */
export const PreviewHistory = ({
  projectsEnabled,
  active,
  onSelect,
}: {
  readonly projectsEnabled: boolean;
  readonly active: boolean;
  readonly onSelect: () => void;
}) => {
  const { setOpenMobile } = useSidebar();
  const trpc = useTRPC();
  const membership = useQuery(
    trpc.project.forChat.queryOptions(
      { id: sampleConversation.id },
      { enabled: projectsEnabled }
    )
  );
  const project = projectsEnabled ? membership.data : null;
  return (
    <SidebarMenu data-testid="sample-history" data-project={project?.id ?? ""}>
      <span className="text-muted-foreground px-2 text-xs">
        {project ? `${project.name} conversations` : "Today"}
      </span>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={active}
          onClick={() => {
            onSelect();
            setOpenMobile(false);
          }}
        >
          {sampleConversation.title}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
