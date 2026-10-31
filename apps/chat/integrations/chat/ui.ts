import { installedChatPlugins } from "@/chatjs/generated/installed-chat-ui";
import { parallelResponsesClient } from "@/components/parallel-responses/client-plugin";

export const chatPlugins = [...installedChatPlugins, parallelResponsesClient];
