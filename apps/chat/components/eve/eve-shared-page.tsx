import { notFound } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React from "react";
import { z } from "zod";

import { ChatHeaderView } from "@/components/chat-header-view";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { getPublicEveTranscript } from "@/lib/eve/public-conversation";

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveSharedBadge } from "./eve-chat-header";
import { EveCopyButton } from "./eve-copy-button";
import { EveSharedMessages } from "./eve-shared-messages";
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
            <Breadcrumb className="ml-2 min-w-0">
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">
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
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth */
