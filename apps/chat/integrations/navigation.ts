import { installedNavigationHandlers } from "@/chatjs/generated/installed-navigation";
import { selectIntegration } from "@/lib/select-integration";

const navigate = selectIntegration(
  "modified navigation",
  installedNavigationHandlers
);
export const handleModifiedNavigation = (): boolean => navigate?.() ?? false;
