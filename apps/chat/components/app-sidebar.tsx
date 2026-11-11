import { headers } from "next/headers";
import components from "@/components.json";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { listEveConversations } from "@/lib/db/eve-queries";
import { ConnectedChatSidebar } from "./chat/connected-chat-sidebar";

const sidebarOwner = async () => {
  const principal = await resolveEvePrincipal(await headers());
  return principal?.ownerId;
};
const sidebarHistory = async (owner: Promise<string | undefined>) => {
  const ownerId = await owner;
  return {
    ownerId,
    history:
      ownerId === undefined
        ? undefined
        : await listEveConversations(ownerId, {
            surface: "sidebar",
            search: "",
          }),
  };
};

export const AppSidebar = () => {
  const ownerId = sidebarOwner();
  return (
    <ConnectedChatSidebar
      direction={components.rtl ? "rtl" : "ltr"}
      ownerId={ownerId}
      history={sidebarHistory(ownerId)}
    />
  );
};
