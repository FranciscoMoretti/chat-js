import { notFound } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ChatHeaderView } from "@/components/chat-header-view";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
/* oxlint-enable sort-imports */
import { getPublicEveTranscript } from "@/lib/eve/public-conversation";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveArtifactLayout } from "./eve-artifact-layout";
/* oxlint-enable sort-imports */
import { EveSharedBadge } from "./eve-chat-header";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveCopyButton } from "./eve-copy-button";
/* oxlint-enable sort-imports */
import { EveSharedMessages } from "./eve-shared-messages";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve EveSharedPage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth -- EveSharedPage: ; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { id }: { id: string }). */

export const EveSharedPage = async ({
  id,
}: {
  readonly id: string;
}): Promise<ReactJSX.Element> => {
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const conversation = await getPublicEveTranscript(id);
  if (!conversation) {
    notFound();
  }
  return (
    <EveArtifactLayout
      conversationId={id}
      messages={conversation.messages}
      readOnly
    >
      <section className="flex h-full min-h-0 flex-col">
        <ChatHeaderView
          actions={<EveSharedBadge />}
          breadcrumb={
            <Breadcrumb
              // oxlint-disable-next-line react/forbid-component-props -- Breadcrumb accepts className in its styling contract; preserve this caller's layout and appearance.
              className="ml-2 min-w-0"
            >
              <BreadcrumbList
                // oxlint-disable-next-line react/forbid-component-props -- BreadcrumbList accepts className in its styling contract; preserve this caller's layout and appearance.
                className="flex-nowrap"
              >
                <BreadcrumbItem
                  // oxlint-disable-next-line react/forbid-component-props -- BreadcrumbItem accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="min-w-0"
                >
                  <BreadcrumbPage
                    // oxlint-disable-next-line react/forbid-component-props -- BreadcrumbPage accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="truncate"
                  >
                    {conversation.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          }
        />
        <EveSharedMessages messages={conversation.messages}>
          <EveCopyButton sourceConversationId={conversation.id} />
        </EveSharedMessages>
      </section>
    </EveArtifactLayout>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth */
