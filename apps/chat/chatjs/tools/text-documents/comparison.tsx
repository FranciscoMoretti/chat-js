"use client";
import { Button } from "@/components/ui/button";
import { DocumentSkeleton } from "@/components/document-skeleton";
import React from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/react";

const DiffView = dynamic(
  async () => {
    const { DiffView: Comparison } = await import("./diffview");
    return Comparison;
  },
  {
    loading: () => <DocumentSkeleton artifactKind="text" />,
    ssr: false,
  }
);

export const EveDocumentComparison = ({
  conversationId,
  documentId,
  previousRevisionId,
  content,
  version,
}: {
  readonly conversationId: string;
  readonly documentId: string;
  readonly previousRevisionId: string;
  readonly content: string;
  readonly version: number;
}): React.JSX.Element => {
  const trpc = useTRPC();
  const previous = useQuery(
    trpc.eve.document.queryOptions({
      conversationId,
      documentId,
      revisionId: previousRevisionId,
    })
  );
  return (
    <section
      aria-label="Document changes"
      className="mx-auto max-w-3xl space-y-4 px-4 py-8"
    >
      <p className="text-muted-foreground text-sm">
        Changes from version {version - 1} to {version}
      </p>
      {previous.isPending && <DocumentSkeleton artifactKind="text" />}
      {previous.isError && (
        <div className="space-y-2" role="alert">
          <p>The previous version could not be loaded.</p>
          {}
          <Button
            onClick={(): void => {
              void previous.refetch();
            }}
            variant="outline"
          >
            Retry comparison
          </Button>
        </div>
      )}
      {previous.data && !previous.isError && (
        <DiffView
          newContent={content}
          oldContent={previous.data.revision.content}
        />
      )}
    </section>
  );
};
