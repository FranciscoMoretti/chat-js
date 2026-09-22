"use client";
import { useQuery } from "@tanstack/react-query";
import { File, Maximize, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import type { z } from "zod";

import { DocumentToolResult } from "@/components/part/document-common";
import { useArtifact } from "@/hooks/use-artifact";
import type { eveDocumentResult } from "@/lib/eve/document-contracts";
import { useTRPC } from "@/trpc/react";

import { DocumentBody } from "./eve-document-body";

export const EveDocumentPreview = ({
  conversationId,
  result,
  messageId,
  action,
  isReadonly,
}: {
  isReadonly: boolean;
  action: "create" | "update" | "read";
  conversationId: string;
  result: z.infer<typeof eveDocumentResult>;
  messageId: string;
}) => {
  const trpc = useTRPC();
  const { artifact, setArtifact } = useArtifact();
  const document = useQuery(
    trpc.eve.document.queryOptions({
      conversationId,
      documentId: result.documentId,
      revisionId: result.revisionId,
    })
  );
  let content: ReactNode = (
    <p className="text-muted-foreground">
      {document.isError
        ? "Open document to retry loading."
        : "Loading document…"}
    </p>
  );
  const isLatest = document.data?.history.at(-1)?.id === result.revisionId;
  if (document.data) {
    content = (
      <DocumentBody
        inline
        title={result.title}
        kind={result.kind}
        editorProps={{
          content: document.data.revision.content,
          currentVersionIndex: 0,
          isCurrentVersion: true,
          isReadonly: true,
          onSaveContent: () => {
            /* Read-only preview never persists editor changes. */
          },
          status: "idle",
        }}
      />
    );
  }

  if (artifact.isVisible) {
    return (
      <DocumentToolResult
        followLive={isLatest}
        isReadonly={isReadonly}
        messageId={messageId}
        result={{ ...result, id: result.documentId }}
        type={action}
      />
    );
  }
  let actionText = "Updated";
  if (action === "read") {
    actionText = "Read";
  }
  if (action === "create") {
    actionText = "Created";
  }
  return (
    <div className="relative w-full" data-testid="document-preview">
      <div className="bg-muted flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 p-4 sm:items-center">
        <div className="flex flex-row items-start gap-3 sm:items-center">
          <div className="text-muted-foreground">
            {action === "update" ? <Pencil size={16} /> : <File size={16} />}
          </div>
          <div className="-translate-y-1 font-medium sm:translate-y-0">
            {result.title}
          </div>
        </div>
        <Maximize size={16} />
      </div>
      <div
        className="bg-muted pointer-events-none flex h-[257px] flex-col overflow-hidden rounded-b-2xl border border-t-0"
        aria-hidden="true"
      >
        {content}
      </div>
      <button
        type="button"
        className="focus-visible:outline-ring absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-2"
        aria-label={`${actionText} "${result.title}"`}
        title="Expand document"
        onClick={() =>
          setArtifact({
            content: "",
            conversationId,
            documentId: result.documentId,
            followLive: isLatest,
            isVisible: true,
            kind: result.kind,
            messageId,
            revisionId: isLatest ? undefined : result.revisionId,
            status: "idle",
            title: result.title,
          })
        }
      />
    </div>
  );
};
