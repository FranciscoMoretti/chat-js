"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import type { JSX as ReactJSX } from "react";

import {
  ShareButton,
  ShareDialogView,
} from "@/chatjs/plugins/sharing/ui/share-button";
import { useTRPC } from "@/trpc/react";

const EveShareDialogContent = ({
  branchId,
  onClose,
}: {
  readonly branchId: string;
  readonly onClose: () => void;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const query = useQuery(trpc.sharing.get.queryOptions({ id: branchId }));
  const mutation = useMutation(trpc.sharing.setVisibility.mutationOptions());
  return (
    <>
      <ShareDialogView
        branchId={branchId}
        isPending={query.isPending || mutation.isPending || query.isError}
        isPublic={query.data?.visibility === "public"}
        onClose={onClose}
        setVisibility={async (visibility) => {
          await mutation.mutateAsync({ id: branchId, visibility });
          await cache.invalidateQueries({
            queryKey: trpc.sharing.get.queryKey({ id: branchId }),
          });
        }}
      />
      {query.error && <p role="alert">{query.error.message}</p>}
    </>
  );
};

const EveShareButton = ({
  branchId,
  className,
}: {
  readonly branchId: string;
  readonly className?: string;
}): React.JSX.Element => (
  <ShareButton
    className={className}
    renderContent={(onClose): React.JSX.Element => (
      <EveShareDialogContent branchId={branchId} onClose={onClose} />
    )}
  />
);
export { EveShareButton, EveShareDialogContent };
