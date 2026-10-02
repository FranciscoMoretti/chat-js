import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const EveChatError = ({ message }: { message: string }) => (
  <Alert variant="destructive">
    <CircleAlert className="size-4" aria-hidden="true" />
    <AlertTitle>Chat error</AlertTitle>
    <AlertDescription className="wrap-anywhere">{message}</AlertDescription>
  </Alert>
);
