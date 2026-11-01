import { defineSandbox } from "eve/sandbox";
import { createAppSandboxEnvironment } from "../lib/eve/sandbox-environment";

export const environment = createAppSandboxEnvironment();

export default defineSandbox(async () => await environment.open());
