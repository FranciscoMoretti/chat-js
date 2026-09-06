"use client";

import equal from "fast-deep-equal";
import { File, Loader2, Maximize, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import { type MouseEvent, memo, useCallback, useMemo, useRef } from "react";
import { useDocuments } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import type { Document } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import type { UIArtifact } from "../artifact-panel";
import { InlineDocumentSkeleton } from "../document-skeleton";
import { DocumentToolCall, DocumentToolResult } from "./document-common";

const CodeEditor = dynamic(
  () => import("../code-editor").then((m) => ({ default: m.CodeEditor })),
  { loading: () => <InlineDocumentSkeleton />, ssr: false }
);

const Editor = dynamic(
  () => import("../text-editor").then((m) => ({ default: m.Editor })),
  { loading: () => <InlineDocumentSkeleton />, ssr: false }
);

const ImageEditor = dynamic(
  () => import("../image-editor").then((m) => ({ default: m.ImageEditor })),
  { loading: () => <InlineDocumentSkeleton />, ssr: false }
);

const SpreadsheetEditor = dynamic(
  () =>
    import("../sheet-editor").then((m) => ({ default: m.SpreadsheetEditor })),
  { loading: () => <InlineDocumentSkeleton />, ssr: false }
);

interface DocumentPreviewInput {
  content: string;
  kind: ArtifactKind;
  title: string;
}

interface DocumentPreviewOutput {
  documentId: string;
  kind: ArtifactKind;
  title: string;
}

interface DocumentPreviewProps {
  input?: DocumentPreviewInput;
  isLastArtifact?: boolean;
  isReadonly: boolean;
  messageId: string;
  output?: DocumentPreviewOutput;
  type?: "create" | "update";
}

export function DocumentPreview({
  isReadonly,
  output,
  input,
  messageId,
  type = "create",
  isLastArtifact = true,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();
  const { data: documents, isLoading: isDocumentsFetching } = useDocuments(
    output?.documentId || "",
    output?.documentId === "init" || artifact.status === "streaming"
  );

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement | null>(null);

  // Show collapsed view if artifact panel is visible OR this is not the last artifact
  if (artifact.isVisible || !isLastArtifact) {
    if (output) {
      return (
        <DocumentToolResult
          isReadonly={isReadonly}
          messageId={messageId}
          result={{
            id: output.documentId,
            title: output.title || artifact.title,
            kind: output.kind,
          }}
          type={type}
        />
      );
    }

    if (input) {
      return (
        <DocumentToolCall
          args={{ title: input.title }}
          isReadonly={isReadonly}
          type={type}
        />
      );
    }
  }

  if (isDocumentsFetching) {
    return (
      <LoadingSkeleton
        artifactKind={output?.kind ?? input?.kind ?? artifact.kind}
      />
    );
  }

  const document: Document | null = (() => {
    if (previewDocument) {
      return previewDocument;
    }
    if (artifact.status === "streaming") {
      return {
        title: artifact.title,
        kind: artifact.kind,
        content: artifact.content,
        id: artifact.documentId,
        createdAt: new Date(),
        userId: "noop",
        messageId: "noop",
      };
    }
    return null;
  })();

  if (!document) {
    return <LoadingSkeleton artifactKind={artifact.kind} />;
  }

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        messageId={messageId}
        output={output}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        isStreaming={artifact.status === "streaming"}
        kind={document.kind}
        title={document.title}
        type={type}
      />
      <DocumentContent document={document} />
    </div>
  );
}

const LoadingSkeleton = ({
  artifactKind: _artifactKind,
}: {
  artifactKind: ArtifactKind;
}) => (
  <div className="w-full">
    <div className="flex h-[57px] flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 bg-muted p-4">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="size-4 animate-pulse rounded-md bg-muted-foreground/20" />
        </div>
        <div className="h-4 w-24 animate-pulse rounded-lg bg-muted-foreground/20" />
      </div>
      <div>
        <Maximize size={16} />
      </div>
    </div>

    <div className="overflow-y-scroll rounded-b-2xl border border-t-0 bg-muted p-8 pt-4">
      <InlineDocumentSkeleton />
    </div>
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  output,
  setArtifact,
  messageId,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  output?: DocumentPreviewOutput;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
  messageId: string;
}) => {
  const handleClick = useCallback(
    (_event: MouseEvent<HTMLElement>) => {
      if (!output) {
        return;
      }
      setArtifact((artifact) => {
        if (artifact.status === "streaming") {
          return { ...artifact, isVisible: true };
        }
        return {
          ...artifact,
          title: output.title,
          documentId: output.documentId,
          messageId,
          kind: output.kind,
          isVisible: true,
        };
      });
    },
    [setArtifact, output, messageId]
  );

  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    >
      <div className="flex w-full items-center justify-end p-4">
        <div className="absolute top-[13px] right-[9px] rounded-md p-2 hover:bg-accent">
          <Maximize size={16} />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.output, nextProps.output)) {
    return false;
  }
  return true;
});

const getActionText = (
  type: "create" | "update",
  tense: "present" | "past"
) => {
  switch (type) {
    case "create":
      return tense === "present" ? "Creating" : "Created";
    case "update":
      return tense === "present" ? "Updating" : "Updated";
    default:
      return "";
  }
};

const PureDocumentHeader = ({
  title,
  kind: _kind,
  isStreaming,
  type,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
  type: "create" | "update";
}) => (
  <div className="flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 bg-muted p-4 sm:items-center">
    <div className="flex flex-row items-start gap-3 sm:items-center">
      <div className="text-muted-foreground">
        {(() => {
          if (isStreaming) {
            return (
              <div className="animate-spin">
                <Loader2 size={16} />
              </div>
            );
          }
          if (type === "update") {
            return <Pencil size={16} />;
          }
          return <File size={16} />;
        })()}
      </div>
      <div className="-translate-y-1 font-medium sm:translate-y-0">
        {isStreaming && type === "update"
          ? `${getActionText(type, "present")} "${title}"`
          : title}
      </div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    "h-[257px] overflow-y-scroll rounded-b-2xl border border-t-0 bg-muted",
    {
      "p-4 sm:px-14 sm:py-16": document.kind === "text",
      "p-0": document.kind === "code",
    }
  );

  const commonProps = {
    content: document.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => {
      // No-op for preview mode
    },
  };

  return (
    <div className={containerClassName}>
      {(() => {
        if (document.kind === "text") {
          return (
            <Editor
              {...commonProps}
              onSaveContent={() => {
                // No-op for preview mode
              }}
            />
          );
        }
        if (document.kind === "code") {
          return (
            <div className="relative flex w-full flex-1">
              <div className="absolute inset-0">
                <CodeEditor
                  {...commonProps}
                  onSaveContent={() => {
                    // No-op for preview mode
                  }}
                />
              </div>
            </div>
          );
        }
        if (document.kind === "sheet") {
          return (
            <div className="relative flex size-full flex-1 p-4">
              <div className="absolute inset-0">
                <SpreadsheetEditor {...commonProps} />
              </div>
            </div>
          );
        }
        if (document.kind === "image") {
          return (
            <ImageEditor
              content={document.content ?? ""}
              currentVersionIndex={0}
              isCurrentVersion={true}
              isInline={true}
              status={artifact.status}
              title={document.title}
            />
          );
        }
        return null;
      })()}
    </div>
  );
};
