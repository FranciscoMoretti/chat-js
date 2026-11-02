"use client";

import { useMemo } from "react";
import { createTRPCClient } from "@trpc/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";
import type { AppRouter } from "@/trpc/routers/_app";
import { TRPCProvider } from "@/trpc/react";
import { makeQueryClient } from "@/trpc/query-client";
import { SessionContext } from "@/providers/session-provider";
import { Plugins } from "@/chatjs/core/ui/slots";
import { feedbackClient } from "@/chatjs/plugins/feedback/client-plugin";
import { projectsClient } from "@/chatjs/plugins/projects/client-plugin";
import {
  ChatActions,
  ChatBreadcrumbs,
  MessageActions,
  SidebarSections,
} from "@/components/chat-slots";
import { ChatSidebarView } from "@/components/chat-sidebar-view";
import { ChatMessageView } from "@/components/chat-message-view";
import * as sidebar from "@/components/ui/sidebar";
import * as message from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  createCommand,
  readInstallationSelection,
  unsupportedCreateSelections,
} from "../../../site/components/create-model";
import { installationSelectionSchema } from "../../../../packages/registry/installation";
import {
  createFixtureTransport,
  sampleConversation,
  sampleMessageId,
} from "./fixture-transport";

const initialSelection = installationSelectionSchema.parse({
  gateway: "vercel",
  plugins: ["feedback", "projects"],
});
const preset = {
  ...DEFAULT_PRESET_CONFIG,
  style: "rhea",
  iconLibrary: "lucide",
} as const;
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

const Sample = ({
  scenario,
  plugins,
}: {
  readonly scenario: "ready" | "mutation-error";
  readonly plugins: readonly string[];
}) => {
  const runtime = useMemo(() => {
    const fixture = createFixtureTransport(scenario);
    return {
      queryClient: makeQueryClient(),
      client: createTRPCClient<AppRouter>({ links: [fixture.link] }),
    };
  }, [scenario]);
  return (
    <QueryClientProvider client={runtime.queryClient}>
      <TRPCProvider
        trpcClient={runtime.client}
        queryClient={runtime.queryClient}
      >
        <SessionContext value={session}>
          <Plugins
            plugins={[feedbackClient, projectsClient].filter((plugin) =>
              plugins.includes(plugin.id)
            )}
          >
            <sidebar.SidebarProvider
              className="relative min-h-[620px] overflow-hidden rounded-lg border [&_[data-slot=sidebar-container]]:absolute"
              style={{ height: 620 }}
            >
              <ChatSidebarView
                primitives={{ ...sidebar, ScrollArea }}
                header={<strong className="p-2">ChatJS</strong>}
                footer={
                  <p className="text-muted-foreground p-2 text-xs">
                    Local sample workspace
                  </p>
                }
              >
                <SidebarSections conversationId={sampleConversation.id} />
                <sidebar.SidebarGroup>
                  <sidebar.SidebarGroupLabel>
                    Conversation
                  </sidebar.SidebarGroupLabel>
                  <sidebar.SidebarMenu>
                    <sidebar.SidebarMenuItem>
                      <sidebar.SidebarMenuButton isActive>
                        {sampleConversation.title}
                      </sidebar.SidebarMenuButton>
                    </sidebar.SidebarMenuItem>
                  </sidebar.SidebarMenu>
                </sidebar.SidebarGroup>
              </ChatSidebarView>
              <main className="flex min-w-0 flex-1 flex-col">
                <header className="flex items-center justify-between gap-3 border-b p-4">
                  <sidebar.SidebarTrigger />
                  <Breadcrumb>
                    <BreadcrumbList>
                      <ChatBreadcrumbs chatId={sampleConversation.id} />
                      <BreadcrumbItem>
                        <BreadcrumbPage>
                          {sampleConversation.title}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                  {plugins.includes("projects") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="outline" />}
                      >
                        Conversation actions
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuGroup>
                          <ChatActions chat={sampleConversation} />
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </header>
                <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
                  <ChatMessageView author="user" primitives={message}>
                    Help me build a small app people will love.
                  </ChatMessageView>
                  <ChatMessageView
                    author="assistant"
                    messageId={sampleMessageId}
                    primitives={message}
                    actions={
                      <div className="mt-4 flex gap-1">
                        <MessageActions
                          conversationId={sampleConversation.id}
                          messageId={sampleMessageId}
                          disabled={false}
                        />
                      </div>
                    }
                  >
                    <h2 className="mb-3 text-xl font-semibold">
                      A small start. A great experience.
                    </h2>
                    <p>
                      Start with one useful conversation. Keep the interface
                      clear and bring your context into a project.
                    </p>
                  </ChatMessageView>
                </section>
              </main>
            </sidebar.SidebarProvider>
          </Plugins>
        </SessionContext>
      </TRPCProvider>
    </QueryClientProvider>
  );
};

export const ControllerPreview = () => {
  const [params, setParams] = useQueryStates({
    installation: parseAsString.withDefault(JSON.stringify(initialSelection)),
    scenario: parseAsStringLiteral(["ready", "mutation-error"]).withDefault(
      "ready"
    ),
  });
  const selection = readInstallationSelection(
    new URLSearchParams({ installation: params.installation }),
    [{ id: "vercel", title: "Vercel" }],
    [{ id: "vercel-blob", title: "Vercel Blob" }]
  );
  if (!selection) {
    return <p role="alert">Invalid installation selection in URL.</p>;
  }
  const command = createCommand(preset, "base", selection);
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-5">
      <h1 className="text-2xl font-semibold">Create · shared controllers</h1>
      <p className="text-muted-foreground text-sm">
        Base UI · installed base-rhea components · Lucide. The library and style
        picker is omitted. Native shadcn preset:{" "}
        <code>{encodePreset(preset)}</code>. The browser uses local data;
        project pages and project CRUD are outside this sample.
      </p>
      <fieldset className="flex flex-wrap gap-5 rounded-lg border p-4">
        <legend>Installation</legend>
        {["feedback", "projects"].map((id) => (
          <label key={id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selection.plugins.includes(id)}
              onChange={(event) => {
                void setParams({
                  installation: JSON.stringify({
                    ...selection,
                    plugins: event.target.checked
                      ? [...selection.plugins, id]
                      : selection.plugins.filter((plugin) => plugin !== id),
                  }),
                });
              }}
            />
            {id}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-3">
        Preview scenario{" "}
        <select
          className="bg-background rounded border p-2"
          value={params.scenario}
          onChange={(event) => {
            void setParams({
              scenario:
                event.target.value === "mutation-error"
                  ? "mutation-error"
                  : "ready",
            });
          }}
        >
          <option value="ready">Ready</option>
          <option value="mutation-error">Mutations fail</option>
        </select>
      </label>
      <Sample
        key={params.scenario}
        scenario={params.scenario}
        plugins={selection.plugins}
      />
      <section className="space-y-2 rounded-lg border p-4">
        <h2 className="font-semibold">CLI handoff · partial</h2>
        <pre className="overflow-auto text-xs" data-testid="create-command">
          {command}
        </pre>
        <ul className="list-disc pl-5 text-sm">
          {unsupportedCreateSelections(selection).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">
          Projects is exact via --projects / --no-projects. Feedback defaults
          off with --yes; enabling it has no existing CLI flag. Preview votes
          and membership reset on reload; installation and scenario survive.
        </p>
      </section>
    </div>
  );
};
