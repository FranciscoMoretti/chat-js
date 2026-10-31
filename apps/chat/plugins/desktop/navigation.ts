import { isElectronRenderer } from "./bridge";

export const desktopNavigation = (): boolean => isElectronRenderer();
