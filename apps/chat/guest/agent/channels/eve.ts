import { eveChannel } from "eve/channels/eve";

import { authenticateDisposableGuest } from "../../../lib/eve/disposable-guest-auth";

export default eveChannel({ auth: authenticateDisposableGuest });
