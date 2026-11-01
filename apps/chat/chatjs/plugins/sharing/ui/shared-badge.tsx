import { Hint } from "@/components/hint";
import React from "react";
import { Share } from "lucide-react";

export const EveSharedBadge = (): React.JSX.Element => (
  <Hint
    trigger={
      <div className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 rounded-md px-2 py-1 text-sm">
        <Share className="opacity-70" size={14} />
        <span>Shared</span>
      </div>
    }
  >
    <div className="text-center">
      <div className="font-medium">Shared Chat</div>
      <div className="text-muted-foreground mt-1 text-xs">
        This is a shared chat
      </div>
    </div>
  </Hint>
);
