/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
/* oxlint-enable eslint/sort-imports */
import { connection } from "next/server";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import React, { Suspense } from "react";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { McpDetailsPage } from "@/components/settings/mcp-details-page";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  SettingsPage,
  SettingsPageHeader,
} from "@/components/settings/settings-page";
/* oxlint-enable eslint/sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
import { makeQueryClient } from "@/trpc/query-client";
import { trpc } from "@/trpc/server";

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
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
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
const ConnectorDetailsBodyFallback = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-10 w-48" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-16 w-5/6" />
  </div>
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable oxc/no-async-await */
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
