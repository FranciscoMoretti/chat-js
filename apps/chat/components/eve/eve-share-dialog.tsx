"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ShareButton, ShareDialogView } from "@/components/share-button";
/* oxlint-enable sort-imports */
import { useTRPC } from "@/trpc/react";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- EveShareDialogContent: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const EveShareDialogContent = ({
  chatId,
  onClose,
}: {
  readonly chatId: string;
  readonly onClose: () => void;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const query = useQuery(trpc.eve.get.queryOptions({ id: chatId }));
  const mutation = useMutation(trpc.eve.setVisibility.mutationOptions());
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return (
    <>
      <ShareDialogView
        chatId={chatId}
        isPending={query.isPending || mutation.isPending || query.isError}
        isPublic={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading visibility from query.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
          query.data?.visibility ===
          /* oxlint-enable oxc/no-optional-chaining */ "public"
        }
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
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp -- EveShareButton: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const EveShareButton = ({
  chatId,
  className,
}: {
  readonly chatId: string;
  readonly className?: string;
}): React.JSX.Element => (
  <ShareButton
    // oxlint-disable-next-line react/forbid-component-props -- ShareButton accepts className in its styling contract; preserve this caller's layout and appearance.
    className={className}
    renderContent={(onClose): React.JSX.Element => (
      <EveShareDialogContent chatId={chatId} onClose={onClose} />
    )}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveShareButton, EveShareDialogContent); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp */
export { EveShareButton, EveShareDialogContent };
/* oxlint-enable import/no-named-export */
