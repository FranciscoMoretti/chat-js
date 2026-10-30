import { installedSessionProfiles } from "../../chatjs/generated/installed-session-profiles";
import { eveChannel } from "eve/channels/eve";
import { requireWorkspaceSeedPaths } from "../../lib/eve/copy-seed";

import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { resolveEveCurrentCopySeed } from "../../lib/db/eve-current-copy";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";

export default eveChannel({
  auth: [
    authenticateEveGateway,
    ...installedSessionProfiles.map((profile) => profile.authenticate),
  ],
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
