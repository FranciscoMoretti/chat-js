"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type ConversationViewController,
  getConversationView,
} from "@/lib/chat/view-store";
import { useApplicationThread } from "@/lib/stores/custom-store-provider";

export const ConversationViewContext =
  createContext<ConversationViewController | null>(null);

/** Mount under the shared runtime binding. Changing binding remounts only this view. */
export function ConversationView({
  id,
  initialCursorId,
  children,
}: {
  id: string;
  initialCursorId?: string | null;
  children: ReactNode;
}) {
  const thread = useApplicationThread();
  return (
    <BoundConversationView
      id={id}
      initialCursorId={initialCursorId}
      key={`${thread.id}:${id}`}
    >
      {children}
    </BoundConversationView>
  );
}

function BoundConversationView({
  id,
  initialCursorId,
  children,
}: {
  id: string;
  initialCursorId?: string | null;
  children: ReactNode;
}) {
  const thread = useApplicationThread();
  const [view] = useState(() =>
    getConversationView({ id, thread, initialCursorId })
  );
  useEffect(() => view.connect(), [view]);
  return (
    <ConversationViewContext.Provider value={view}>
      {children}
    </ConversationViewContext.Provider>
  );
}

export function useConversationView() {
  const view = useContext(ConversationViewContext);
  if (!view) {
    throw new Error("Place conversation components inside ConversationView");
  }
  return view;
}
