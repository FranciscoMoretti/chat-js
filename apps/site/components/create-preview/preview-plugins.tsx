"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../chat/trpc/routers/_app";
import { TRPCProvider } from "../../../chat/trpc/context";
import { SessionContext } from "../../../chat/providers/session-context";
import { Plugins } from "../../../chat/chatjs/core/ui/slots";
import { feedbackClient } from "../../../chat/chatjs/plugins/feedback/client-plugin";
import { projectsClient } from "../../../chat/chatjs/plugins/projects/client-plugin";
import { createFixtureTransport } from "./fixture-transport";
import { creditsClient } from "../../../chat/chatjs/plugins/credits/client-plugin";
import { searchClient } from "../../../chat/chatjs/plugins/search/client-plugin";
import { livePreviewPlugins } from "./preview-capabilities";

import { modelPreferencesClient } from "../../../chat/chatjs/plugins/model-preferences/client-plugin";
import { attachmentUploadsClient } from "../../../chat/chatjs/plugins/attachment-uploads/client-plugin";

const FixtureContext = createContext<ReturnType<
  typeof createFixtureTransport
> | null>(null);
export const usePreviewFixtures = () => {
  const fixture = useContext(FixtureContext);
  if (!fixture) {
    throw new Error("Preview fixtures required");
  }
  return fixture;
};
const clients = {
  "model-preferences": modelPreferencesClient,
  "attachment-uploads": attachmentUploadsClient,
  feedback: feedbackClient,
  projects: projectsClient,
  credits: creditsClient,
  search: searchClient,
};

const date = new Date("2026-01-01T00:00:00Z");
export const previewSession = {
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
  const runtime = useMemo(() => {
    const fixtures = createFixtureTransport(scenario);
    return {
      fixtures,
      queryClient: new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: false } },
      }),
      client: createTRPCClient<AppRouter>({
        links: [fixtures.link],
      }),
    };
  }, [scenario]);
  return (
    <QueryClientProvider key={scenario} client={runtime.queryClient}>
      <TRPCProvider
        queryClient={runtime.queryClient}
        trpcClient={runtime.client}
      >
        <SessionContext value={previewSession}>
          <FixtureContext value={runtime.fixtures}>
            <Plugins
              plugins={livePreviewPlugins
                .filter((id) => enabled.includes(id))
                .map((id) => clients[id])}
            >
              {children}
            </Plugins>
          </FixtureContext>
        </SessionContext>
      </TRPCProvider>
    </QueryClientProvider>
  );
};
