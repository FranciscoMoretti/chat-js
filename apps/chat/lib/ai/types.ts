import type { toolNameSchema } from "@/chatjs/core/tools/tool-definition";

import { selectableToolNames } from "@/integrations/tools/selection";
import type { AppModelId } from "./app-models";
import { z } from "zod";

type ToolName = z.infer<typeof toolNameSchema>;

const frontendToolsSchema = z.enum([...selectableToolNames]);

type UiToolName = z.infer<typeof frontendToolsSchema>;

type SelectedModelCounts = Readonly<Partial<Record<AppModelId, number>>>;

type SelectedModelValue = AppModelId | SelectedModelCounts;

export { frontendToolsSchema };
export type { SelectedModelValue, ToolName, UiToolName };

export { toolNameSchema } from "@/chatjs/core/tools/tool-definition";
