/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/db/eve-copy-dispatch"; "../../lib/db/eve-queries"; "../../lib/eve/channel-files"; "../../lib/eve/gateway-auth" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { eveChannel } from "eve/channels/eve";

import { resolveAcceptedEveCopySeed } from "../../lib/db/eve-copy-dispatch";
import { ownsEveSession } from "../../lib/db/eve-queries";
import { fetchEveChannelFile } from "../../lib/eve/channel-files";
import { authenticateEveGateway } from "../../lib/eve/gateway-auth";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export, typescript/promise-function-async --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * typescript/promise-function-async (#606): default export preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export default eveChannel({
  auth: authenticateEveGateway,
  authorizeFork: ({ auth, sourceSessionId }): Promise<boolean> =>
    ownsEveSession(auth.principalId, sourceSessionId),
  fetchFile: fetchEveChannelFile,
  resolveSeed: ({ auth, operationId }) =>
    resolveAcceptedEveCopySeed(auth.principalId, operationId),
});
/* oxlint-enable import/no-default-export, typescript/promise-function-async */
