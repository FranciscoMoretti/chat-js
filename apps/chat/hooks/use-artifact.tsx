"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

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
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, no-ternary, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ArtifactProvider: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children: ReactNode }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ArtifactProvider = ({ children }: { children: ReactNode }) => {
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
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, no-ternary, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- useArtifactContext: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const useArtifactContext = () => {
  const context = useContext(ArtifactContext);
  if (!context) {
    throw new Error("Artifact hooks must be used within ArtifactProvider");
  }
  return context;
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/group-exports, import/no-named-export, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useArtifactSelector: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useArtifactSelector = <Selected,>(
  selector: Selector<Selected>
) => {
  const { artifact } = useArtifactContext();

  const selectedValue = useMemo(() => selector(artifact), [artifact, selector]);

  return selectedValue;
};
/* oxlint-enable import/group-exports, import/no-named-export, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export, no-ternary, oxc/no-rest-spread-properties, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useArtifact: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including currentArtifact); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const useArtifact = () => {
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
      closeArtifact,
      metadata,
      resetArtifact,
      setArtifact,
      setMetadata,
    }),
    [artifact, setArtifact, metadata, setMetadata, resetArtifact, closeArtifact]
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-ternary, oxc/no-rest-spread-properties, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
