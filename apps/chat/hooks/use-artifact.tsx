"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { JSX as ReactJSX, ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ArtifactMetadata, UIArtifact } from "@/lib/artifacts/types";
/* oxlint-enable sort-imports */

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

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types -- Selector: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including state: UIArtifact). */

type Selector<T> = (state: UIArtifact) => T;
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

type MetadataUpdater = (current: ArtifactMetadata) => ArtifactMetadata;

type MetadataStore = Record<string, ArtifactMetadata>;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ArtifactContextType: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including currentArtifact: UIArtifact). */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable no-undefined -- ArtifactContext: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

const ArtifactContext = createContext<ArtifactContextType | undefined>(
  undefined
);
/* oxlint-enable no-undefined */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- ArtifactProvider:   typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children: ReactNode }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ArtifactProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactJSX.Element => {
  const [artifactState, setArtifactState] =
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
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: Artifact metadata intentionally varies with document kind; narrowing it requires a discriminated metadata/store API migration.
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */

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

/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --   typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including currentArtifact); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

interface ArtifactHookValue {
  artifact: UIArtifact;
  closeArtifact: () => void;
  metadata: ArtifactMetadata;
  resetArtifact: () => void;
  setArtifact: ArtifactContextType["setArtifact"];
  setMetadata: (metadataArg: ArtifactMetadata | MetadataUpdater) => void;
}

const useArtifact = (): ArtifactHookValue => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: Consumers import ArtifactProvider, useArtifact, useArtifactSelector from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { ArtifactProvider, useArtifact, useArtifactSelector };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
