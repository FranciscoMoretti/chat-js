"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { MessageSquare, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useDeferredValue,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useTRPC } from "@/trpc/react";

const createdGroup = (createdAt: string | Date) => {
  const date = new Date(createdAt);
  if (isToday(date)) {
    return "Today";
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (date > subWeeks(new Date(), 1)) {
    return "Last 7 days";
  }
  if (date > subMonths(new Date(), 1)) {
    return "Last 30 days";
  }
  return "Older";
};

const SearchResults = ({
  onSelect,
  ownerId,
}: {
  onSelect: (id: string) => void;
  ownerId: string;
}) => {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim());
  const history = useInfiniteQuery(
    trpc.eve.list.infiniteQueryOptions(
      { ownerScope: ownerId, search },
      { getNextPageParam: (page) => page.nextCursor }
    )
  );
  const items = history.data?.pages.flatMap((page) => page.items) ?? [];
  const seen = new Set<string>();
  const distinct = items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return item.state === "bound";
  });
  const groups = [
    "Today",
    "Yesterday",
    "Last 7 days",
    "Last 30 days",
    "Older",
  ].map((label) => ({
    items: distinct.filter((item) => createdGroup(item.createdAt) === label),
    label,
  }));
  return (
    <Command
      className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
      shouldFilter={false}
    >
      <CommandInput
        placeholder="Search your chats..."
        value={query}
        onValueChange={setQuery}
        maxLength={255}
      />
      <CommandList>
        {history.isPending && (
          <p className="text-muted-foreground p-4 text-sm">Loading chats…</p>
        )}
        {history.isError && (
          <div className="p-4 text-sm" role="alert">
            Could not load chats.{" "}
            <Button variant="ghost" onClick={() => history.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {!history.isPending && !history.isError && (
          <CommandEmpty>No chats found.</CommandEmpty>
        )}
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <CommandGroup heading={group.label} key={group.label}>
              {group.items.map((item) => (
                <CommandItem
                  className="flex cursor-pointer items-center gap-2 p-2"
                  key={item.id}
                  value={item.id}
                  onSelect={() => onSelect(item.id)}
                >
                  <MessageSquare className="text-muted-foreground h-4 w-4" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.title}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        {history.hasNextPage && (
          <Button
            variant="ghost"
            disabled={history.isFetching}
            onClick={() => history.fetchNextPage()}
          >
            {history.isFetchingNextPage ? "Loading…" : "Load more chats"}
          </Button>
        )}
      </CommandList>
    </Command>
  );
};

const searchShortcut = () =>
  navigator.platform.toUpperCase().includes("MAC") ? "Cmd+K" : "Ctrl+K";
const subscribePlatform = () => () => null;
const serverShortcut = () => "Ctrl+K";

export const EveSearchChats = ({ ownerId }: { ownerId?: string }) => {
  const shortcut = useSyncExternalStore(
    subscribePlatform,
    searchShortcut,
    serverShortcut
  );
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  return (
    <>
      <SidebarMenuButton tooltip="Search chats" onClick={() => setOpen(true)}>
        <SearchIcon className="size-4" />
        <span>Search chats</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {shortcut}
        </span>
      </SidebarMenuButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Search chats</DialogTitle>
            <DialogDescription>
              Search your conversation history.
            </DialogDescription>
          </DialogHeader>
          {open && !ownerId && (
            <p className="text-muted-foreground p-4 text-sm">
              Start a chat to see your conversation history.
            </p>
          )}
          {open && ownerId && (
            <SearchResults
              ownerId={ownerId}
              onSelect={(id) => {
                setOpen(false);
                setOpenMobile(false);
                router.push(`/chat/${id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
