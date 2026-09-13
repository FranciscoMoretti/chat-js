import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { useSidebar } from "@/components/ui/sidebar";
import {
  useGetAllChats,
  usePinChat,
  useRenameChat,
} from "@/hooks/chat-sync-hooks";
import type { UIChat } from "@/lib/types/ui-chat";
import { parseChatIdFromPathname } from "@/providers/parse-chat-id-from-pathname";

import { DeleteChatDialog } from "./delete-chat-dialog";
import { SidebarChatItem } from "./sidebar-chat-item";
import { Skeleton } from "./ui/skeleton";

interface GroupedChats {
  lastMonth: UIChat[];
  lastWeek: UIChat[];
  older: UIChat[];
  pinned: UIChat[];
  today: UIChat[];
  yesterday: UIChat[];
}

export const SidebarChatsList = () => {
  const pathname = usePathname();
  const { data: allChats, isLoading } = useGetAllChats({ limit: 50 });
  const { setOpenMobile } = useSidebar();
  const { mutate: renameChatMutation } = useRenameChat();
  const { mutate: pinChatMutation } = usePinChat();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Filter chats: non-project chats only (projectId == null)
  const chats = useMemo(
    () => allChats?.filter((chat) => chat.projectId === null) ?? [],
    [allChats]
  );

  // Extract chatId from URL for /chat routes and /project routes
  const chatId = useMemo(() => {
    const parsed = parseChatIdFromPathname(pathname);
    return parsed.id;
  }, [pathname]);

  const groupedChats = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = subWeeks(now, 1);
    const oneMonthAgo = subMonths(now, 1);

    // Separate pinned and non-pinned chats
    const pinnedChats = chats.filter((chat) => chat.isPinned);
    const nonPinnedChats = chats.filter((chat) => !chat.isPinned);

    const groups = nonPinnedChats.reduce(
      (acc, chat) => {
        const chatDate = new Date(chat.updatedAt);

        if (isToday(chatDate)) {
          acc.today.push(chat);
        } else if (isYesterday(chatDate)) {
          acc.yesterday.push(chat);
        } else if (chatDate > oneWeekAgo) {
          acc.lastWeek.push(chat);
        } else if (chatDate > oneMonthAgo) {
          acc.lastMonth.push(chat);
        } else {
          acc.older.push(chat);
        }

        return acc;
      },
      {
        lastMonth: [],
        lastWeek: [],
        older: [],
        pinned: [],
        today: [],
        yesterday: [],
      } as GroupedChats
    );

    // Add pinned chats (sorted by most recently updated first)
    groups.pinned = pinnedChats.toSorted(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return groups;
  }, [chats]);

  if (isLoading) {
    return (
      <div className="flex flex-col">
        {[44, 32, 28, 64, 52].map((item) => (
          <div
            className="flex h-8 items-center gap-2 rounded-md px-2"
            key={item}
          >
            <Skeleton className="h-4 flex-1" style={{ width: `${item}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-muted-foreground flex w-full flex-row items-center justify-center gap-2 px-2 py-4 text-sm">
        Start chatting to see your conversation history!
      </div>
    );
  }

  const prefetchLimit = 10;
  let renderedChatsCount = 0;
  const shouldPrefetchNextChat = () => {
    const shouldPrefetch = renderedChatsCount < prefetchLimit;
    renderedChatsCount += 1;
    return shouldPrefetch;
  };

  return (
    <>
      {groupedChats.pinned.length > 0 && (
        <>
          <div className="text-sidebar-foreground/50 px-2 py-1 text-xs">
            Pinned
          </div>
          {groupedChats.pinned.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}

      {groupedChats.today.length > 0 && (
        <>
          <div
            className={`text-sidebar-foreground/50 px-2 py-1 text-xs ${groupedChats.pinned.length > 0 ? "mt-6" : ""}`}
          >
            Today
          </div>
          {groupedChats.today.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}

      {groupedChats.yesterday.length > 0 && (
        <>
          <div className="text-sidebar-foreground/50 mt-6 px-2 py-1 text-xs">
            Yesterday
          </div>
          {groupedChats.yesterday.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}

      {groupedChats.lastWeek.length > 0 && (
        <>
          <div className="text-sidebar-foreground/50 mt-6 px-2 py-1 text-xs">
            Last 7 days
          </div>
          {groupedChats.lastWeek.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}

      {groupedChats.lastMonth.length > 0 && (
        <>
          <div className="text-sidebar-foreground/50 mt-6 px-2 py-1 text-xs">
            Last 30 days
          </div>
          {groupedChats.lastMonth.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}

      {groupedChats.older.length > 0 && (
        <>
          <div className="text-sidebar-foreground/50 mt-6 px-2 py-1 text-xs">
            Older
          </div>
          {groupedChats.older.map((chat) => (
            <SidebarChatItem
              chat={chat}
              isActive={chat.id === chatId}
              key={chat.id}
              onDelete={(id) => {
                setDeleteId(id);
                setShowDeleteDialog(true);
              }}
              onPin={(id, isPinned) => {
                pinChatMutation({ chatId: id, isPinned });
              }}
              onRename={(id, title) => {
                renameChatMutation({ chatId: id, title });
              }}
              prefetch={shouldPrefetchNextChat()}
              setOpenMobile={setOpenMobile}
            />
          ))}
        </>
      )}
      <DeleteChatDialog
        deleteId={deleteId}
        setShowDeleteDialog={setShowDeleteDialog}
        showDeleteDialog={showDeleteDialog}
      />
    </>
  );
};
