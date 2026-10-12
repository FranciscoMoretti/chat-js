"use client";

import type { ArtifactMetadata, UIArtifact } from "@/lib/artifacts/types";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { JSX as ReactJSX } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

const initialArtifactData: UIArtifact = {
  content: "",
  date: undefined,
  documentId: "init",
  isVisible: false,
  kind: "text",
  messageId: "",
  status: "idle",
  title: "",
};

type Selector<Selected> = (state: UIArtifact) => Selected;

type MetadataUpdater = (current: ArtifactMetadata) => ArtifactMetadata;

// Function-valued updates are callbacks; stored metadata is the callback result.
const isMetadataUpdater = (
  value: ArtifactMetadata | MetadataUpdater
): value is MetadataUpdater => typeof value === "function";

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

const ArtifactProvider = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): ReactJSX.Element => {
  const [artifactState, setArtifactState] =
    useState<UIArtifact>(initialArtifactData);
  const [metadataStore, setMetadataStore] = useState<MetadataStore>({});

  const setArtifact = useCallback(
    (updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)) => {
      setArtifactState((currentArtifact: UIArtifact) => {
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
      setMetadataStore((current: Readonly<MetadataStore>) => ({
        ...current,
        [documentId]: isMetadataUpdater(metadata)
          ? metadata(current[documentId] ?? null)
          : metadata,
      }));
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      artifact: artifactState,
      metadata: metadataStore,
      setArtifact,
      setMetadata,
    }),
    [artifactState, setArtifact, metadataStore, setMetadata]
  );

  return (
    <ArtifactContext.Provider value={contextValue}>
      {children}
    </ArtifactContext.Provider>
  );
};

const useArtifactContext = (): ArtifactContextType => {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error("Artifact hooks must be used within ArtifactProvider");
  }
  return context;
};

const useArtifactSelector = <Selected,>(
  selector: Selector<Selected>
): Selected => {
  const { artifact } = useArtifactContext();

  const selectedValue = useMemo(() => selector(artifact), [artifact, selector]);

  return selectedValue;
};

interface ArtifactHookValue {
  artifact: UIArtifact;
  closeArtifact: () => void;
  metadata: ArtifactMetadata;
  resetArtifact: () => void;
  setArtifact: ArtifactContextType["setArtifact"];
  setMetadata: (metadataArg: ArtifactMetadata | MetadataUpdater) => void;
}

const hideArtifact = (currentArtifact: UIArtifact): UIArtifact => {
  if (currentArtifact.status === "streaming") {
    return { ...currentArtifact, isVisible: false };
  }
  return { ...initialArtifactData, status: "idle" };
};

const useArtifact = (): ArtifactHookValue => {
  const {
    artifact,
    setArtifact,
    metadata: metadataStore,
    setMetadata: setMetadataStore,
  } = useArtifactContext();

  const metadata = useMemo(() => {
    if (artifact.documentId) {
      return metadataStore[artifact.documentId] ?? null;
    }
    return null;
  }, [metadataStore, artifact.documentId]);

  const setMetadata = useCallback(
    (metadataArg: ArtifactMetadata | MetadataUpdater): void => {
      if (artifact.documentId) {
        setMetadataStore(artifact.documentId, metadataArg);
      }
    },
    [artifact.documentId, setMetadataStore]
  );

  const resetArtifact = useCallback((): void => {
    setArtifact(initialArtifactData);
  }, [setArtifact]);

  const closeArtifact = useCallback((): void => {
    setArtifact(hideArtifact);
  }, [setArtifact]);

  return useMemo(
    () => ({
      artifact,
      closeArtifact,
      metadata,
      resetArtifact,
      setArtifact,
      setMetadata,
    }),
    [artifact, setArtifact, metadata, setMetadata, resetArtifact, closeArtifact]
  );
};
export { ArtifactProvider, useArtifact, useArtifactSelector };
