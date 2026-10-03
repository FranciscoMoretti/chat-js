"use client";

import React from "react";

import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- DocumentSkeleton: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const DocumentSkeleton = ({
  artifactKind: _artifactKind,
}: {
  artifactKind: ArtifactKind;
}): React.JSX.Element => (
  <div className="flex w-full flex-col gap-4">
    <div className="bg-muted-foreground/20 h-12 w-1/2 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-5 w-full animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-5 w-full animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-5 w-1/3 animate-pulse rounded-lg" />
    <div className="h-5 w-52 animate-pulse rounded-lg bg-transparent" />
    <div className="bg-muted-foreground/20 h-8 w-52 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-5 w-2/3 animate-pulse rounded-lg" />
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp -- InlineDocumentSkeleton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

const InlineDocumentSkeleton = (): React.JSX.Element => (
  <div className="flex w-full flex-col gap-4">
    <div className="bg-muted-foreground/20 h-4 w-48 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-3/4 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-1/2 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-64 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-40 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-36 animate-pulse rounded-lg" />
    <div className="bg-muted-foreground/20 h-4 w-64 animate-pulse rounded-lg" />
  </div>
);
/* oxlint-enable react/no-multi-comp */
export { DocumentSkeleton, InlineDocumentSkeleton };
