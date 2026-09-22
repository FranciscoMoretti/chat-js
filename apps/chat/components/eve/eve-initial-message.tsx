"use client";

import { AttachmentList } from "@/components/attachment-list";
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
import type { EveMessageInput } from "@/lib/eve/message-input";

/** Keep the accepted first message visible until the native transcript catches up. */
export const EveInitialMessage = ({
  message,
}: {
  message: EveMessageInput;
}) => {
  const draft = restoreDraft(message);
  return (
    <UserMessageView
      actions={null}
      attachments={<AttachmentList attachments={draft.attachments} />}
      text={draft.text}
    />
  );
};
