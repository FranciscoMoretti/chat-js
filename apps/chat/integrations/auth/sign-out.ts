import { installedSignOutHandlers } from "@/chatjs/generated/installed-sign-out";
import { selectIntegration } from "@/chatjs/core/installation/select";

const pluginSignOut = selectIntegration("sign out", installedSignOutHandlers);
export const signOutWithPlugin = async (): Promise<boolean> =>
  pluginSignOut ? await pluginSignOut() : false;
