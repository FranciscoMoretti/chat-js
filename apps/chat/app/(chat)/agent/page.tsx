import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { EveConversation } from "@/components/eve/eve-conversation";
import { NewEveConversation } from "@/components/eve/new-eve-conversation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { getEveConversation, listEveConversations } from "@/lib/db/eve-queries";
import { isEveEnabled } from "@/lib/eve/availability";

export default function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-4">Opening conversation…</p>}>
      <AgentPageContent searchParams={searchParams} />
    </Suspense>
  );
}
async function AgentPageContent({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  if (!isEveEnabled()) {
    notFound();
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const { conversation } = await searchParams;
  if (conversation && !z.uuid().safeParse(conversation).success) {
    notFound();
  }
  const [selected, recent] = await Promise.all([
    conversation
      ? getEveConversation(session.user.id, conversation)
      : undefined,
    listEveConversations(session.user.id),
  ]);
  if (conversation && !selected) {
    notFound();
  }
  return (
    <section className="flex h-dvh min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b p-3">
        <SidebarTrigger />
        <h1 className="font-semibold">Agent chat</h1>
        <Link className="ml-auto text-sm underline" href="/agent">
          New conversation
        </Link>
      </header>
      {selected?.sessionId && selected.state === "bound" && (
        <EveConversation
          key={selected.sessionId}
          sessionId={selected.sessionId}
        />
      )}
      {selected && !(selected.sessionId && selected.state === "bound") && (
        <p className="p-4" role="alert">
          Creation is unresolved. Keep conversation {selected.id} for
          reconciliation before retrying.
        </p>
      )}
      {!selected && (
        <>
          <NewEveConversation key={session.user.id} ownerId={session.user.id} />
          <nav
            aria-label="Agent conversations"
            className="mx-auto max-h-[30dvh] w-full max-w-3xl shrink-0 space-y-2 overflow-y-auto border-t p-4"
          >
            {recent.length > 0 && (
              <h2 className="font-medium text-sm">Recent conversations</h2>
            )}
            {recent.map((row) => (
              <Link
                className="block truncate text-sm underline"
                href={`/agent?conversation=${row.id}`}
                key={row.id}
              >
                {row.firstMessage.slice(0, 100)}
                {row.state === "bound" ? "" : " (unresolved)"}
              </Link>
            ))}
          </nav>
        </>
      )}
    </section>
  );
}
