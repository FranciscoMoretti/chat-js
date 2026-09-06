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
import type { ArtifactMetadata } from "@/components/create-artifact";

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
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
  setMetadata: (
    documentId: string,
    metadata: ArtifactMetadata | MetadataUpdater
  ) => void;
}

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined
);

export function ArtifactProvider({ children }: { children: ReactNode }) {
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
      setArtifact,
      metadata: metadataStore,
      setMetadata,
    }),
    [artifact, setArtifact, metadataStore, setMetadata]
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
  const {
    artifact,
    setArtifact,
    metadata: metadataStore,
    setMetadata: setMetadataStore,
  } = useArtifactContext();

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
      setArtifact,
      resetArtifact,
      closeArtifact,
      metadata,
      setMetadata,
    }),
    [artifact, setArtifact, metadata, setMetadata, resetArtifact, closeArtifact]
  );
}
