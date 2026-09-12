import { createRoot } from "react-dom/client";
import { EveComparisonConversation } from "../components/eve/eve-comparison-conversation";
import { NewEveConversation } from "../components/eve/new-eve-conversation";
import { TooltipProvider } from "../components/ui/tooltip";
import { DefaultModelProvider } from "../providers/default-model-provider";
import {
  completeGroup,
  firstConversation,
  firstModel,
  ownerId,
  partialGroup,
  secondConversation,
  secondModel,
} from "./eve-comparison-data.fixture";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root");
}
const comparison = location.pathname.startsWith("/chat/");
const second = location.pathname.endsWith(secondConversation);
createRoot(root).render(
  <TooltipProvider>
    <DefaultModelProvider
      defaultModel={
        document.cookie.split("; ").includes(`chat-model=${secondModel}`)
          ? secondModel
          : firstModel
      }
    >
      {comparison ? (
        <EveComparisonConversation
          conversationId={second ? secondConversation : firstConversation}
          header={<h1 className="p-4 text-lg">Compare answers</h1>}
          initialGroup={second ? completeGroup : partialGroup}
          ownerId={ownerId}
        />
      ) : (
        <NewEveConversation ownerId={ownerId} />
      )}
    </DefaultModelProvider>
  </TooltipProvider>
);
