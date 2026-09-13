import { setupRenderer } from "@better-auth/electron/preload";
import { contextBridge, ipcRenderer } from "electron";

// Setup @better-auth/electron renderer bridges.
// Exposes window.requestAuth(), window.onAuthenticated(), window.signOut(), etc.
setupRenderer();

// Expose additional app metadata to the renderer process.
contextBridge.exposeInMainWorld("electronAPI", {
  cancelAuthFlow: () => ipcRenderer.invoke("chatjs:cancel-auth-flow"),
  getAuthState: () => ipcRenderer.invoke("chatjs:get-auth-state"),
  isElectron: true,
  onAuthStateChanged: (callback: (state: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: unknown) => {
      callback(state);
    };

    ipcRenderer.on("chatjs:auth-state-changed", listener);
    return () => {
      ipcRenderer.removeListener("chatjs:auth-state-changed", listener);
    };
  },
  platform: process.platform,
  syncAuthSession: () => ipcRenderer.invoke("chatjs:sync-auth-session"),
});
