import { useQueryClient } from "@tanstack/react-query";
import { formatDistance } from "date-fns";
import type { Dispatch, SetStateAction } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { useDocuments, useSaveDocument } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import {
  codeArtifact,
  getCodeArtifactMetadata,
} from "@/lib/artifacts/code/client";
import {
  getSheetArtifactMetadata,
  sheetArtifact,
} from "@/lib/artifacts/sheet/client";
import { textArtifact } from "@/lib/artifacts/text/client";
import type { Document } from "@/lib/db/schema";
import {
  useChatActions,
  useChatStatus,
  useChatStoreApi,
} from "@/lib/stores/base";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";
import {
  Artifact as ArtifactCard,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactActions as ArtifactHeaderActions,
  ArtifactTitle,
} from "./ai-elements/artifact";
import { ArtifactActions as ArtifactPanelActions } from "./artifact-actions";
import type { ArtifactMetadata } from "./create-artifact";
//
import { Toolbar } from "./toolbar";
import { ScrollArea } from "./ui/scroll-area";
import { VersionFooter } from "./version-footer";

export const artifactDefinitions = [textArtifact, codeArtifact, sheetArtifact];

export interface UIArtifact {
  content: string;
  date?: string;
  documentId: string;
  isVisible: boolean;
  kind: ArtifactKind;
  messageId: string;
  status: "streaming" | "idle";
  title: string;
}

function createTypedMetadataSetter<M extends ArtifactMetadata>(
  setMetadata: Dispatch<SetStateAction<ArtifactMetadata>>,
  coerce: (metadata: ArtifactMetadata) => M
): Dispatch<SetStateAction<M>> {
  return (value) => {
    setMetadata((current) => {
      const typedCurrent = coerce(current);
      return typeof value === "function" ? value(typedCurrent) : value;
    });
  };
}

function PureArtifactPanel({
  isReadonly,
  isAuthenticated,
  className,
}: {
  isReadonly: boolean;
  isAuthenticated: boolean;
  className?: string;
}) {
  const storeApi = useChatStoreApi<ChatMessage>();
  const { artifact, setArtifact, metadata, setMetadata, closeArtifact } =
    useArtifact();
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { data: documents, isLoading: isDocumentsFetching } = useDocuments(
    artifact.documentId || "",
    artifact.documentId === "init" || artifact.status === "streaming"
  );

  const [mode, setMode] = useState<"edit" | "diff">("edit");
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const lastSavedContentRef = useRef<string>("");

  useEffect(() => {
    if (documents && documents.length > 0) {
      // At first we set the most recent document realted to the messageId selected
      const mostRecentDocumentIndex = documents.findLastIndex(
        (doc) => doc.messageId === artifact.messageId
      );

      if (mostRecentDocumentIndex === -1) {
        // Fallback to the most recent document
        const latestDocument = documents.at(-1);
        if (latestDocument) {
          setDocument(latestDocument);
          setCurrentVersionIndex(documents.length - 1);
          setArtifact((currentArtifact) => ({
            ...currentArtifact,
            content: latestDocument.content ?? "",
          }));
        }
      } else {
        const mostRecentDocument = documents[mostRecentDocumentIndex];
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(mostRecentDocumentIndex);
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: mostRecentDocument.content ?? "",
        }));
      }
    }
  }, [documents, setArtifact, artifact.messageId]);

  const [isContentDirty, setIsContentDirty] = useState(false);

  const saveDocumentMutation = useSaveDocument(
    artifact.documentId,
    artifact.messageId,
    {
      onSettled: () => {
        setIsContentDirty(false);
      },
    }
  );

  const handleContentChange = useCallback(
    (updatedContent: string) => {
      if (!documents) {
        return;
      }

      const lastDocument = documents.at(-1);
      if (!lastDocument) {
        return;
      }

      if (
        lastDocument?.content !== updatedContent &&
        lastSavedContentRef.current === updatedContent
      ) {
        setIsContentDirty(true);
        saveDocumentMutation.mutate({
          id: lastDocument.id,
          title: lastDocument.title,
          content: updatedContent,
          kind: lastDocument.kind,
        });
      }
    },
    [saveDocumentMutation, documents]
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      if (isReadonly) {
        return;
      }
      // Update the last saved content reference
      lastSavedContentRef.current = updatedContent;

      if (document && updatedContent !== document.content) {
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      }
    },
    [document, debouncedHandleContentChange, handleContentChange, isReadonly]
  );

  function getDocumentContentById(index: number) {
    if (!documents) {
      return "";
    }
    if (!documents[index]) {
      return "";
    }
    return documents[index].content ?? "";
  }

  const handleVersionChange = (type: "next" | "prev" | "toggle" | "latest") => {
    if (!documents) {
      return;
    }

    if (type === "latest") {
      setCurrentVersionIndex(documents.length - 1);
      setMode("edit");
    }

    if (type === "toggle") {
      setMode((currentMode) => (currentMode === "edit" ? "diff" : "edit"));
    }

    if (type === "prev") {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === "next" && currentVersionIndex < documents.length - 1) {
      setCurrentVersionIndex((index) => index + 1);
    }
  };

  const status = useChatStatus();
  const { stop } = useChatActions<ChatMessage>();
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  useEffect(() => {
    if (artifact.documentId !== "init" && artifact.status !== "streaming") {
      switch (artifact.kind) {
        case "code":
          codeArtifact.initialize?.({
            documentId: artifact.documentId,
            setMetadata: createTypedMetadataSetter(
              setMetadata,
              getCodeArtifactMetadata
            ),
            trpc,
            queryClient,
            isAuthenticated,
          });
          break;
        case "sheet":
          sheetArtifact.initialize?.({
            documentId: artifact.documentId,
            setMetadata: createTypedMetadataSetter(
              setMetadata,
              getSheetArtifactMetadata
            ),
            trpc,
            queryClient,
            isAuthenticated,
          });
          break;
        case "text":
          textArtifact.initialize?.({
            documentId: artifact.documentId,
            setMetadata,
            trpc,
            queryClient,
            isAuthenticated,
          });
          break;
        default:
          break;
      }
    }
  }, [
    artifact.documentId,
    artifact.kind,
    setMetadata,
    trpc,
    queryClient,
    isAuthenticated,
    artifact.status,
  ]);

  if (!artifact.isVisible) {
    return null;
  }

  const resolvedContent = isCurrentVersion
    ? artifact.content
    : getDocumentContentById(currentVersionIndex);

  const sharedArtifactProps = {
    content: resolvedContent,
    currentVersionIndex,
    getDocumentContentById,
    isCurrentVersion,
    isInline: false,
    isLoading: isDocumentsFetching && !artifact.content,
    isReadonly,
    metadata,
    mode,
    onSaveContent: saveContent,
    setMetadata,
    status: artifact.status,
    title: artifact.title,
  };

  const renderArtifactContent = () => {
    switch (artifact.kind) {
      case "code":
        return (
          <>
            <codeArtifact.content
              {...sharedArtifactProps}
              metadata={getCodeArtifactMetadata(metadata)}
              setMetadata={createTypedMetadataSetter(
                setMetadata,
                getCodeArtifactMetadata
              )}
            />
            {codeArtifact.footer ? (
              <codeArtifact.footer
                {...sharedArtifactProps}
                metadata={getCodeArtifactMetadata(metadata)}
                setMetadata={createTypedMetadataSetter(
                  setMetadata,
                  getCodeArtifactMetadata
                )}
              />
            ) : null}
          </>
        );
      case "sheet":
        return (
          <>
            <sheetArtifact.content
              {...sharedArtifactProps}
              metadata={getSheetArtifactMetadata(metadata)}
              setMetadata={createTypedMetadataSetter(
                setMetadata,
                getSheetArtifactMetadata
              )}
            />
            {sheetArtifact.footer ? (
              <sheetArtifact.footer
                {...sharedArtifactProps}
                metadata={getSheetArtifactMetadata(metadata)}
                setMetadata={createTypedMetadataSetter(
                  setMetadata,
                  getSheetArtifactMetadata
                )}
              />
            ) : null}
          </>
        );
      case "text":
        return (
          <>
            <textArtifact.content
              {...sharedArtifactProps}
              metadata={metadata}
              setMetadata={setMetadata}
            />
            {textArtifact.footer ? (
              <textArtifact.footer
                {...sharedArtifactProps}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            ) : null}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <ArtifactCard
      className={cn(
        "h-full w-full rounded-none border-0 border-border bg-background transition-all duration-200 ease-out",
        className
      )}
      data-testid="artifact"
    >
      <ArtifactHeader className="items-start bg-background/80 p-2">
        <div className="flex flex-row items-start gap-4">
          <ArtifactClose
            className="h-fit p-2 hover:bg-accent"
            data-testid="artifact-close-button"
            onClick={closeArtifact}
            variant="outline"
          />

          <div className="flex flex-col">
            <ArtifactTitle>{artifact.title}</ArtifactTitle>

            {(() => {
              if (isContentDirty) {
                return (
                  <ArtifactDescription>Saving changes...</ArtifactDescription>
                );
              }
              const dateSource = artifact.date ?? document?.createdAt;
              if (dateSource) {
                return (
                  <ArtifactDescription>
                    {`Updated ${formatDistance(
                      new Date(dateSource),
                      new Date(),
                      {
                        addSuffix: true,
                      }
                    )}`}
                  </ArtifactDescription>
                );
              }
              return (
                <div className="mt-2 h-3 w-32 animate-pulse rounded-md bg-muted-foreground/20" />
              );
            })()}
          </div>
        </div>

        <ArtifactHeaderActions>
          <ArtifactPanelActions
            artifact={artifact}
            currentVersionIndex={currentVersionIndex}
            handleVersionChange={handleVersionChange}
            isCurrentVersion={isCurrentVersion}
            isReadonly={isReadonly}
            metadata={metadata}
            mode={mode}
            setMetadata={setMetadata}
          />
        </ArtifactHeaderActions>
      </ArtifactHeader>

      <ArtifactContent className="flex h-full flex-col p-0">
        <ScrollArea className="h-full max-w-full!">
          <div className="flex flex-col items-center bg-background/80">
            {renderArtifactContent()}

            {isCurrentVersion && !isReadonly && (
              <Toolbar
                artifactKind={artifact.kind}
                isToolbarVisible={isToolbarVisible}
                setIsToolbarVisible={setIsToolbarVisible}
                status={status}
                stop={stop}
                storeApi={storeApi}
              />
            )}
          </div>
        </ScrollArea>

        {!(isCurrentVersion || isReadonly) && (
          <VersionFooter
            currentVersionIndex={currentVersionIndex}
            documents={documents}
            handleVersionChange={handleVersionChange}
          />
        )}
      </ArtifactContent>
    </ArtifactCard>
  );
}

export const ArtifactPanel = memo(PureArtifactPanel, (prevProps, nextProps) => {
  if (prevProps.isReadonly !== nextProps.isReadonly) {
    return false;
  }
  if (prevProps.isAuthenticated !== nextProps.isAuthenticated) {
    return false;
  }
  if (prevProps.className !== nextProps.className) {
    return false;
  }

  return true;
});
