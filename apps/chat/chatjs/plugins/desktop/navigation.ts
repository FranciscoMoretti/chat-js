import { isElectronRenderer } from "./bridge";

const desktopNavigation = (): boolean => isElectronRenderer();

export default desktopNavigation;
