"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import type { JSX as ReactJSX } from "react";

import {
  ShareButton,
  ShareDialogView,
} from "@/plugins/sharing/ui/share-button";
import { useTRPC } from "@/trpc/react";

const EveShareDialogContent = ({
  chatId,
  onClose,
}: {
  readonly chatId: string;
  readonly onClose: () => void;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const query = useQuery(trpc.sharing.get.queryOptions({ id: chatId }));
  const mutation = useMutation(trpc.sharing.setVisibility.mutationOptions());
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
            queryKey: trpc.sharing.get.queryKey({ id: chatId }),
          });
        }}
      />
      {query.error && <p role="alert">{query.error.message}</p>}
    </>
  );
};

const EveShareButton = ({
  chatId,
  className,
}: {
  readonly chatId: string;
  readonly className?: string;
}): React.JSX.Element => (
  <ShareButton
    className={className}
    renderContent={(onClose): React.JSX.Element => (
      <EveShareDialogContent chatId={chatId} onClose={onClose} />
    )}
  />
);
export { EveShareButton, EveShareDialogContent };
