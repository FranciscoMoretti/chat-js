import config from "./chat.config";
import { createModel } from "./integrations/model";
export const model = createModel(config.model);
