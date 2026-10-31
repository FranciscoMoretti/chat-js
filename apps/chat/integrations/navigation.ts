import { installedNavigationHandlers } from "@/chatjs/generated/installed-navigation";
import { selectIntegration } from "@/chatjs/core/installation/select";

const navigate = selectIntegration(
  "modified navigation",
  installedNavigationHandlers
);
export const handleModifiedNavigation = (): boolean => navigate?.() ?? false;
