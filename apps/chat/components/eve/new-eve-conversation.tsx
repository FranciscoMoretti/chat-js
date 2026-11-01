"use client";

import React from "react";
import { EveComposer } from "./eve-composer";
import { NewConversationView } from "./new-conversation-view";
import { useNewEveConversation } from "./use-new-eve-conversation";

export const NewEveConversation = (
  props: Parameters<typeof useNewEveConversation>[0]
): React.JSX.Element => {
  const [, startEventAction] = React.useTransition();
  const { composer, contextual, submission } = useNewEveConversation(props);
  return (
    <NewConversationView
      contextual={contextual}
      submission={submission}
      composer={
        <EveComposer
          {...composer}
          onSubmit={() => {
            // Invoke synchronously so duplicate events see the submission lock.
            const completion = submission.submit();
            startEventAction(async () => {
              await completion;
            });
          }}
        />
      }
    />
  );
};
