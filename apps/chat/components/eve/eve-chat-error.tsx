import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const EveChatError = ({
  children,
  message,
  title = "Chat error",
}: {
  readonly children?: ReactNode;
  readonly message: string;
  readonly title?: string;
}): ReactNode => (
  <Alert
    className="has-[>svg]:grid-cols-[auto_minmax(0,1fr)]"
    variant="destructive"
  >
    <CircleAlert className="size-4" aria-hidden="true" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription className="wrap-anywhere">{message}</AlertDescription>
    {children !== undefined && (
      <div className="col-start-2 mt-2">{children}</div>
    )}
  </Alert>
);
