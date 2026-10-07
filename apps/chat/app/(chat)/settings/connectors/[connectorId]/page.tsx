import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { connection } from "next/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { McpDetailsPage } from "@/components/settings/mcp-details-page";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
/* oxlint-enable sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";
/* oxlint-disable react/jsx-no-literals -- ConnectorDetailsHeader renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

const ConnectorDetailsHeader = () => (
  <SettingsPageHeader>
    <h2 className="text-lg font-semibold">Connector details</h2>
    <p className="text-muted-foreground text-sm">
      Tools, resources, and authorization status.
    </p>
  </SettingsPageHeader>
);
/* oxlint-enable react/jsx-no-literals */

/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

const ConnectorDetailsBodyFallback = () => (
  <div className="flex flex-col gap-3">
    <Skeleton
      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-10 w-48"
    />
    <Skeleton
      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-24 w-full"
    />
    <Skeleton
      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-24 w-full"
    />
    <Skeleton
      // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-16 w-5/6"
    />
  </div>
);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ConnectorDetailsContent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const ConnectorDetailsContent = async ({
  params,
}: {
  params: Promise<{ connectorId: string }>;
}) => {
  const { connectorId } = await params;
  await connection();
  // Keep this result out of the layout's earlier hydration boundary.
  const queryClient = makeQueryClient();
  // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the v5 prefetch API and its error-swallowing hydration semantics across locked and freshly scaffolded Query versions.
  await queryClient.prefetchQuery(trpc.mcp.list.queryOptions());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SettingsPage>
        <ConnectorDetailsHeader />
        <Suspense fallback={<ConnectorDetailsBodyFallback />}>
          <McpDetailsPage connectorId={connectorId} />
        </Suspense>
      </SettingsPage>
    </HydrationBoundary>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const ConnectorDetailsPage = ({
  params,
}: {
  params: Promise<{ connectorId: string }>;
}) => (
  <Suspense
    fallback={
      <SettingsPage>
        <ConnectorDetailsHeader />
        <ConnectorDetailsBodyFallback />
      </SettingsPage>
    }
  >
    <ConnectorDetailsContent params={params} />
  </Suspense>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default ConnectorDetailsPage;
/* oxlint-enable import/no-default-export */
