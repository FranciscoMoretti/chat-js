import { Skeleton } from "@/components/ui/skeleton";

export function ChatLoadingShell() {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 px-2 md:px-2">
        <Skeleton className="size-8 shrink-0 md:hidden" />
        <Skeleton className="h-5 w-36" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 py-6">
        <Skeleton className="h-16 w-3/4 max-w-xl rounded-2xl" />
        <Skeleton className="ml-auto h-14 w-2/3 max-w-lg rounded-2xl" />
        <Skeleton className="h-20 w-4/5 max-w-2xl rounded-2xl" />
      </div>
      <div className="shrink-0 p-4">
        <Skeleton className="mx-auto h-14 w-full max-w-3xl rounded-2xl" />
      </div>
    </div>
  );
}
