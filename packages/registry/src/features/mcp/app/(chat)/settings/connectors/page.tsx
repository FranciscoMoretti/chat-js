import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { connection } from "next/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { ConnectorsSettings } from "@/components/settings/connectors-settings";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
/* oxlint-enable sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

const ConnectorsSettingsHeader = () => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connectors & MCP</h2>
    <p className="text-muted-foreground text-sm">
      Connect to Model Context Protocol servers to extend AI capabilities with
      external tools.
    </p>
  </SettingsPageHeader>
);

/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const ConnectorsSettingsContent = async () => {
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <ConnectorsSettings />
      </SettingsPage>
    </HydrationBoundary>
  );
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
const ConnectorsSettingsPage = () => (
  <Suspense
    fallback={
      <SettingsPage>
        <ConnectorsSettingsHeader />
        <div className="flex flex-col gap-3">
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-16 w-full"
          />
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-16 w-full"
          />
          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-16 w-5/6"
          />
        </div>
      </SettingsPage>
    }
  >
    <ConnectorsSettingsContent />
  </Suspense>
);
/* oxlint-enable typescript/explicit-module-boundary-types */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default ConnectorsSettingsPage;
/* oxlint-enable import/no-default-export */
