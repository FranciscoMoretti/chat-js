import { eveChannel } from "eve/channels/eve";
import { requireWorkspaceSeedPaths } from "../../lib/eve/copy-seed";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { resolveEveCurrentCopySeed } from "../../lib/db/eve-current-copy";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  auth: authenticateEveGateway,
  fetchFile: fetchEveChannelFile,
  resolveSeed: async ({ auth, operationId }) => {
    const seed = await resolveEveCurrentCopySeed(auth.principalId, operationId);
    if (seed.attachments !== "channel") {
      throw new Error(
        "Shared-workspace forks require channel attachment resolution."
      );
    }
    return {
      ...requireWorkspaceSeedPaths(seed),
      attachments: seed.attachments,
    };
  },
});
