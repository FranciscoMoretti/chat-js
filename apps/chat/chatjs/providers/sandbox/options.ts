import type { EnvRequirement } from "@/lib/config-requirements";

const sandboxId = "vercel";
const sandboxEnvRequirements: EnvRequirement[] = [
  {
    options: [
      ["VERCEL_OIDC_TOKEN"],
      ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
    ],
    runtimeAuth: "vercel-oidc",
  },
];
export { sandboxId, sandboxEnvRequirements };
