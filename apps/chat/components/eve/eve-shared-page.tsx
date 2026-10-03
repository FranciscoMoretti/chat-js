/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { notFound } from "next/navigation";
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
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-async-await, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- EveSharedPage: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { id }: { id: string }). */

export const EveSharedPage = async ({ id }: { id: string }) => {
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-async-await, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
