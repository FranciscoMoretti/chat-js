import { headers } from "next/headers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

import { listEveConversations } from "@/lib/db/eve-queries";
import { resolveEvePrincipal } from "@/lib/eve/principal";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveHistoryList } from "./eve-history-list";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve EveHistory's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null -- EveHistory: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveHistory = async () => {
  const principal = await resolveEvePrincipal(await headers());
  if (!principal) {
    return null;
  }
  const current = await listEveConversations(principal.ownerId, {
    projectId: null,
    search: "",
  });
  return (
    <EveHistoryList
      initialPage={current}
      key={principal.ownerId}
      ownerId={principal.ownerId}
    />
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
