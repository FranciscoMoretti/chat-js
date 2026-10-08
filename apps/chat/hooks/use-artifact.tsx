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

/* oxlint-disable no-undefined -- initialArtifactData: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

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
/* oxlint-enable no-undefined */

type Selector<Selected> = (state: UIArtifact) => Selected;

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

/* oxlint-disable no-undefined -- ArtifactContext: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined
);
/* oxlint-enable no-undefined */
/* oxlint-disable unicorn/no-null -- unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...current,
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: Artifact metadata intentionally varies with document kind; narrowing it requires a discriminated metadata/store API migration.
        [documentId]:
          // oxlint-disable-next-line no-ternary -- Keep [documentId] as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof metadata === "function"
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
/* oxlint-enable unicorn/no-null */

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

/* oxlint-disable unicorn/no-null -- null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
    /* oxlint-disable oxc/no-rest-spread-properties -- Preserve all current streaming fields while hiding the artifact; Object.assign conflicts with eslint/prefer-object-spread. */
    return { ...currentArtifact, isVisible: false };
    /* oxlint-enable oxc/no-rest-spread-properties */
  }
  /* oxlint-disable oxc/no-rest-spread-properties -- Copy the complete initial artifact with idle status; Object.assign conflicts with eslint/prefer-object-spread. */
  return { ...initialArtifactData, status: "idle" };
  /* oxlint-enable oxc/no-rest-spread-properties */
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ArtifactProvider, useArtifact, useArtifactSelector); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: Consumers import ArtifactProvider, useArtifact, useArtifactSelector from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { ArtifactProvider, useArtifact, useArtifactSelector };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
