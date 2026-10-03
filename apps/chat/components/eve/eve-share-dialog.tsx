"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";

import { ShareButton, ShareDialogView } from "@/components/share-button";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/group-exports, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- EveShareDialogContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveShareDialogContent = ({
  chatId,
  onClose,
}: {
  chatId: string;
  onClose: () => void;
}) => {
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
};
/* oxlint-enable import/group-exports, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EveShareButton: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const EveShareButton = ({
  chatId,
  className,
}: {
  chatId: string;
  className?: string;
}): React.JSX.Element => (
  <ShareButton
    className={className}
    renderContent={(onClose): React.JSX.Element => (
      <EveShareDialogContent chatId={chatId} onClose={onClose} />
    )}
  />
);
/* oxlint-enable import/group-exports, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
