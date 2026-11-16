import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

export const ResearchTask = ({
  update,
}: Readonly<{
  update: ReadonlyNativeSurface<ResearchUpdate>;
}>): React.JSX.Element => (
  <div className="group">
    <div className="flex min-w-0 flex-col gap-2">
      {update.type === "thoughts" && (
        <div className="space-y-2">
          <p className="text-foreground text-sm font-light">{update.message}</p>
        </div>
      )}
      {update.type === "writing" &&
        update.message !== undefined &&
        update.message !== "" && (
          <div className="space-y-2">
            <p className="text-foreground text-sm font-light">
              {update.message}
            </p>
          </div>
        )}
    </div>
  </div>
);
