"use client";

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "../../../chat/trpc/routers/_app";
import { TRPCProvider } from "../../../chat/trpc/context";
import { SessionContext } from "../../../chat/providers/session-context";
import { chatUi as streamdownMathClient } from "../../../chat/chatjs/plugins/streamdown-math/chat-ui";
import { chatUi as streamdownMermaidClient } from "../../../chat/chatjs/plugins/streamdown-mermaid/chat-ui";
import { chatUi as spreadsheetViewerClient } from "../../../chat/chatjs/plugins/spreadsheet-viewer/chat-ui";
import { chatUi as videoViewerClient } from "../../../chat/chatjs/plugins/video-viewer/chat-ui";
import { chatUi as imageViewerClient } from "../../../chat/chatjs/plugins/image-viewer/chat-ui";
import { Plugins } from "../../../chat/chatjs/core/ui/slots";
import { chatUi as feedbackClient } from "../../../chat/chatjs/plugins/feedback/chat-ui";
import { chatUi as projectsClient } from "../../../chat/chatjs/plugins/projects/chat-ui";
import { createFixtureTransport } from "./fixture-transport";
import { chatUi as creditsClient } from "../../../chat/chatjs/plugins/credits/chat-ui";
import { chatUi as searchClient } from "../../../chat/chatjs/plugins/search/chat-ui";
import { livePreviewPlugins } from "./preview-capabilities";
import type { UiPlugin } from "../../../chat/chatjs/core/ui/slots";
import { chatUi as mcpClient } from "../../../chat/chatjs/plugins/mcp/chat-ui";
import { chatUi as sharingClient } from "../../../chat/chatjs/plugins/sharing/chat-ui";
import { chatUi as followupSuggestionsClient } from "../../../chat/chatjs/plugins/followup-suggestions/chat-ui";
import { SharingEnvironmentContext } from "../../../chat/chatjs/plugins/sharing/ui/share-button";

import { chatUi as modelPreferencesClient } from "../../../chat/chatjs/plugins/model-preferences/chat-ui";
import { chatUi as attachmentUploadsClient } from "../../../chat/chatjs/plugins/attachment-uploads/chat-ui";

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
  "streamdown-math": streamdownMathClient,
  "streamdown-mermaid": streamdownMermaidClient,
  "image-viewer": imageViewerClient,
  "video-viewer": videoViewerClient,
  "spreadsheet-viewer": spreadsheetViewerClient,
  mcp: mcpClient,
  sharing: sharingClient,
  "followup-suggestions": followupSuggestionsClient,
  "model-preferences": modelPreferencesClient,
  "attachment-uploads": attachmentUploadsClient,
  feedback: feedbackClient,
  projects: projectsClient,
  credits: creditsClient,
  search: searchClient,
} satisfies Record<(typeof livePreviewPlugins)[number], UiPlugin>;

// A copied preview link opens Create, never an unpublished production /share route.
const previewSharingEnvironment = {
  getUrl: () => {
    const url = new URL(window.parent.location.href);
    url.pathname = "/create";
    url.searchParams.set("item", "preview-02");
    url.searchParams.delete("__previewScenario");
    url.hash = "";
    return url.href;
  },
  notice:
    "Sample sharing only. Nothing is published; copied links open Create.",
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
            <SharingEnvironmentContext value={previewSharingEnvironment}>
              <Plugins
                plugins={livePreviewPlugins
                  .filter((id) => enabled.includes(id))
                  .map((id) => clients[id])}
              >
                {children}
              </Plugins>
            </SharingEnvironmentContext>
          </FixtureContext>
        </SessionContext>
      </TRPCProvider>
    </QueryClientProvider>
  );
};
