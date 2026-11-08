import squirrelStartup from "electron-squirrel-startup";

// The handler quits after shortcut work completes. Installer launches must not
// acquire the normal app lock, register protocols, or create windows.
if (!squirrelStartup) {
  void import("./application");
}
