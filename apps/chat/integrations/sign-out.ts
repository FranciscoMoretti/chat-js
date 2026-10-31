import { installedSignOutHandlers } from "@/chatjs/generated/installed-sign-out";
import { selectIntegration } from "@/lib/select-integration";

const pluginSignOut = selectIntegration("sign out", installedSignOutHandlers);
export const signOutWithPlugin = async (): Promise<boolean> =>
  pluginSignOut ? await pluginSignOut() : false;
