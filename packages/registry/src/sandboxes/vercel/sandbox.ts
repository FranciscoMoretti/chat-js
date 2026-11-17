import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment();
export default defineSandbox(async () => await environment.open());
