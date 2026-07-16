"use client";

import { useChatStatus } from "@/lib/stores/base";
import { useMessageMetadataById } from "@/lib/stores/hooks-base";
import { Skeleton } from "./ui/skeleton";

export function PartialMessageLoading({ messageId }: { messageId: string }) {
  const metadata = useMessageMetadataById(messageId);
  const status = useChatStatus();
  const isLoading =
    metadata.activeStreamId?.startsWith("pending:") ||
    (metadata.activeStreamId && status === "submitted");

  if (!isLoading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-4/5 rounded-full" />
      <Skeleton className="h-4 w-3/5 rounded-full" />
      <Skeleton className="h-4 w-2/5 rounded-full" />
    </div>
  );
}
