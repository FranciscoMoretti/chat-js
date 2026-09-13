"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ShareButton, ShareDialogView } from "@/components/share-button";
import { useTRPC } from "@/trpc/react";

export function EveShareDialogContent({
  chatId,
  onClose,
}: {
  chatId: string;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const query = useQuery(trpc.eve.get.queryOptions({ id: chatId }));
  const mutation = useMutation(trpc.eve.setVisibility.mutationOptions());
  return (
    <>
      <ShareDialogView
        chatId={chatId}
        isPending={query.isPending || mutation.isPending || query.isError}
        isPublic={query.data?.visibility === "public"}
        onClose={onClose}
        setVisibility={async (visibility) => {
          await mutation.mutateAsync({ id: chatId, visibility });
          await cache.invalidateQueries({
            queryKey: trpc.eve.get.queryKey({ id: chatId }),
          });
        }}
      />
      {query.error && <p role="alert">{query.error.message}</p>}
    </>
  );
}

export function EveShareButton({ chatId }: { chatId: string }) {
  return (
    <ShareButton
      chatId={chatId}
      renderContent={(onClose) => (
        <EveShareDialogContent chatId={chatId} onClose={onClose} />
      )}
    />
  );
}
