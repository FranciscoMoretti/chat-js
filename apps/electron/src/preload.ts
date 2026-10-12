import { contextBridge, ipcRenderer } from "electron";
import { setupRenderer } from "@better-auth/electron/preload";

// Setup @better-auth/electron renderer bridges.
// Exposes window.requestAuth(), window.onAuthenticated(), window.signOut(), etc.
setupRenderer();

// Expose additional app metadata to the renderer process.
contextBridge.exposeInMainWorld("electronAPI", {
  cancelAuthFlow: async (): Promise<unknown> =>
    await ipcRenderer.invoke("chatjs:cancel-auth-flow"),
  getAuthState: async (): Promise<unknown> =>
    await ipcRenderer.invoke("chatjs:get-auth-state"),
  isElectron: true,
  onAuthStateChanged: (onStateChange: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown): void => {
      onStateChange(state);
    };

    ipcRenderer.on("chatjs:auth-state-changed", listener);
    return (): void => {
      ipcRenderer.removeListener("chatjs:auth-state-changed", listener);
    };
  },
  platform: process.platform,
  syncAuthSession: async (): Promise<unknown> =>
    await ipcRenderer.invoke("chatjs:sync-auth-session"),
});
