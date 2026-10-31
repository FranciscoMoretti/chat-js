import type { DynamicContext } from "eve";
import { isAccountSession } from "../../lib/eve/session-identity";
import { defineDynamic } from "eve/tools";

import { eveImageContext } from "../../lib/eve/image-context";
import { eveToolImageContext } from "../../lib/eve/tool-image-context";
import { filterEveTools } from "../../lib/eve/turn-tools";
import { tools } from "../../integrations/tools";

export default defineDynamic(async (context: DynamicContext) => {
  if (!isAccountSession(context.session)) {
    return {};
  }
  const images = eveImageContext(await context.messages());
  eveToolImageContext.update(() => images);
  return filterEveTools(tools);
});
