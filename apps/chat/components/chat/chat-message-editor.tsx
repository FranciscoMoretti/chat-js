import type { ReactNode } from "react";

/** Shared edit presentation; the runtime owns branching and draft recovery. */
export const ChatMessageEditor = ({
  composer,
  error,
}: {
  readonly composer: ReactNode;
  readonly error?: string;
}) => (
  <div className="w-full">
    <p className="text-muted-foreground mb-2 text-sm">
      Replace this message in a new branch. Later messages are not included. All
      branches share workspace files and the installed environment. Forking does
      not roll files back.
    </p>
    {composer}
    {error !== undefined && error !== "" && (
      <p className="text-destructive text-sm" role="alert">
        {error}
      </p>
    )}
  </div>
);
