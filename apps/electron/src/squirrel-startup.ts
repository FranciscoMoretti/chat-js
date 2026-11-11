import { spawn } from "node:child_process";
import path from "node:path";
import { app } from "electron";

export const handleSquirrelStartup = (): boolean => {
  if (process.platform !== "win32") {
    return false;
  }

  const [, event] = process.argv;
  if (event === "--squirrel-obsolete") {
    app.quit();
    return true;
  }

  let operation: string;
  switch (event) {
    case "--squirrel-install":
    case "--squirrel-updated": {
      operation = "createShortcut";
      break;
    }
    case "--squirrel-uninstall": {
      operation = "removeShortcut";
      break;
    }
    default: {
      // Includes --squirrel-firstrun, which must open the application.
      return false;
    }
  }

  const updateExe = path.resolve(
    path.dirname(process.execPath),
    "..",
    "Update.exe"
  );
  try {
    const updater = spawn(
      updateExe,
      [`--${operation}=${path.basename(process.execPath)}`],
      { detached: true, stdio: "ignore" }
    );
    let launchFailed = false;
    updater.once("error", (error) => {
      launchFailed = true;
      console.error("Could not launch Squirrel shortcut update:", error);
    });
    // Node emits close after error even if the subprocess could not spawn.
    updater.once("close", (code) => {
      if (!launchFailed && code !== 0) {
        console.error("Squirrel shortcut update failed with exit code:", code);
      }
      app.quit();
    });
  } catch (error) {
    console.error("Could not launch Squirrel shortcut update:", error);
    app.quit();
  }
  return true;
};
