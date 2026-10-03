/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { headers } from "next/headers";
import React from "react";

import { listEveConversations } from "@/lib/db/eve-queries";
import { resolveEvePrincipal } from "@/lib/eve/principal";

import { EveHistoryList } from "./eve-history-list";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null -- EveHistory: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
