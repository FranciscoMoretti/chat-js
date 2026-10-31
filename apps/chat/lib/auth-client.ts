import { createAuthClient } from "better-auth/react";
import { lastLoginMethodClient } from "better-auth/client/plugins";

const authClient = createAuthClient({ plugins: [lastLoginMethodClient()] });
export default authClient;
