import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";

// Render has no local VM daemon. EVE owns this virtual workspace; ChatJS tools
// retain their separately configured execution providers.
export const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(async () => await environment.open());
