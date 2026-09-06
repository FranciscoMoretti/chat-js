"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { UIArtifact } from "@/components/artifact-panel";
import { ConversationViewContext } from "@/components/chat/conversation-view";
import type { ArtifactMetadata } from "@/components/create-artifact";
import {
  type ArtifactOrigin,
  createArtifactOrigin,
} from "@/lib/chat/artifact-origin";
import { useOptionalChatInput } from "@/providers/chat-input-provider";

const initialArtifactData: UIArtifact = {
  documentId: "init",
  content: "",
  kind: "text",
  title: "",
  messageId: "",
  status: "idle",
  isVisible: false,
  date: undefined,
};

type Selector<T> = (state: UIArtifact) => T;

type MetadataUpdater = (current: ArtifactMetadata) => ArtifactMetadata;

type MetadataStore = Record<string, ArtifactMetadata>;

interface ArtifactContextType {
  artifact: UIArtifact;
  metadata: MetadataStore;
  origin: ArtifactOrigin | null;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
  setMetadata: (
    documentId: string,
    metadata: ArtifactMetadata | MetadataUpdater
  ) => void;
  setOrigin: (origin: ArtifactOrigin) => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined
);

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [origin, setOrigin] = useState<ArtifactOrigin | null>(null);
  const [artifact, setArtifactState] =
    useState<UIArtifact>(initialArtifactData);
  const [metadataStore, setMetadataStore] = useState<MetadataStore>({});

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setArtifactState((currentArtifact) => {
        if (typeof updaterFn === "function") {
          return updaterFn(currentArtifact);
        }
        return updaterFn;
      });
    },
    []
  );

  const setMetadata = useCallback(
    (documentId: string, metadata: ArtifactMetadata | MetadataUpdater) => {
      setMetadataStore((current) => ({
        ...current,
        [documentId]:
          typeof metadata === "function"
            ? metadata(current[documentId] ?? null)
            : metadata,
      }));
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      artifact,
      origin,
      setOrigin,
      setArtifact,
      metadata: metadataStore,
      setMetadata,
    }),
    [artifact, origin, setArtifact, metadataStore, setMetadata]
  );

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  );
}

function useArtifactContext() {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error("Artifact hooks must be used within ArtifactProvider");
  }
  return context;
}

export function useArtifactSelector<Selected>(selector: Selector<Selected>) {
  const { artifact } = useArtifactContext();

  const selectedValue = useMemo(() => selector(artifact), [artifact, selector]);

  return selectedValue;
}

export function useArtifact() {
  const view = useContext(ConversationViewContext);
  const input = useOptionalChatInput();
  const {
    artifact,
    origin,
    setOrigin,
    setArtifact,
    metadata: metadataStore,
    setMetadata: setMetadataStore,
  } = useArtifactContext();

  const openArtifact = useCallback(
    (next: UIArtifact) => {
      if (!view) {
        throw new Error("Open a document from a conversation view");
      }
      setOrigin(
        createArtifactOrigin(
          view,
          next.messageId,
          input?.selectedModelId,
          !input
        )
      );
      setArtifact(next);
    },
    [view, input, setArtifact, setOrigin]
  );

  const metadata = useMemo(
    () =>
      artifact.documentId ? (metadataStore[artifact.documentId] ?? null) : null,
    [metadataStore, artifact.documentId]
  );

  const setMetadata = useCallback(
    (metadataArg: ArtifactMetadata | MetadataUpdater) => {
      if (artifact.documentId) {
        setMetadataStore(artifact.documentId, metadataArg);
      }
    },
    [artifact.documentId, setMetadataStore]
  );

  const resetArtifact = useCallback(() => {
    setArtifact(initialArtifactData);
  }, [setArtifact]);

  const closeArtifact = useCallback(() => {
    setArtifact((currentArtifact) =>
      currentArtifact.status === "streaming"
        ? {
            ...currentArtifact,
            isVisible: false,
          }
        : { ...initialArtifactData, status: "idle" }
    );
  }, [setArtifact]);

  return useMemo(
    () => ({
      artifact,
      origin,
      openArtifact,
      setArtifact,
      resetArtifact,
      closeArtifact,
      metadata,
      setMetadata,
    }),
    [
      artifact,
      origin,
      openArtifact,
      setArtifact,
      metadata,
      setMetadata,
      resetArtifact,
      closeArtifact,
    ]
  );
}
