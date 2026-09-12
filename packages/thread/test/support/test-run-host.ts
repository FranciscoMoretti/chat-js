import type { ChatStatus, ChatTransport, UIMessage } from "ai";

import type { ThreadRunHost, ThreadRunSpec } from "../../src/ai-sdk-run-chat";
import { MessageTree } from "../../src/message-tree";

const generateMessageId = () => "client-response";
const registerToolCall: ThreadRunHost<UIMessage>["registerToolCall"] = () =>
  null;

export class TestRunHost implements ThreadRunHost<UIMessage> {
  readonly dataPartSchemas = undefined;
  readonly id = "thread";
  readonly messageMetadataSchema = undefined;
  readonly generateMessageId = generateMessageId;
  readonly spec: ThreadRunSpec;
  readonly tree: MessageTree<UIMessage>;
  onData: ThreadRunHost<UIMessage>["onData"];
  onError: ThreadRunHost<UIMessage>["onError"];
  onFinish: ThreadRunHost<UIMessage>["onFinish"];
  onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
  sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
  transport: ChatTransport<UIMessage>;
  status: ChatStatus = "ready";
  readonly errors: Error[] = [];

  constructor(
    transport: ChatTransport<UIMessage>,
    initialMessage: UIMessage,
    spec: ThreadRunSpec
  ) {
    this.transport = transport;
    this.spec = spec;
    this.tree = new MessageTree({ messages: [initialMessage] });
  }

  getMessagePath = (messageId: string | null) => this.tree.getPath(messageId);
  updateRunPath = (messages: UIMessage[]) => {
    this.tree.updatePath(messages);
  };
  registerToolCall = registerToolCall;
  removeMessage = (messageId: string) => this.tree.removeLeaf(messageId);
  setRunError = (_runId: string, error: Error | undefined) => {
    if (error) {
      this.errors.push(error);
    }
  };
  setRunStatus = (_runId: string, status: ChatStatus) => {
    this.status = status;
  };
  writeRunMessage = (_runId: string, message: UIMessage) => {
    if (this.spec.messageId && this.spec.messageId !== message.id) {
      throw new Error("Run message identity changed");
    }
    if (!this.spec.messageId && this.tree.has(message.id)) {
      throw new Error("Run message identity already exists");
    }
    this.spec.messageId = message.id;
    this.tree.upsertMessage(message, this.spec.parentMessageId);
  };
}
