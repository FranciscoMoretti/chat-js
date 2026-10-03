import type { ChatStatus, ChatTransport, UIMessage } from "ai";

import type { ThreadRunHost, ThreadRunSpec } from "../../src/ai-sdk-run-chat";
import { MessageTree } from "../../src/message-tree";

const generateMessageId = () => "client-response";
const registerToolCall: ThreadRunHost<UIMessage>["registerToolCall"] = () =>
  null;

export class TestRunHost implements ThreadRunHost<UIMessage> {
  public readonly dataPartSchemas = undefined;
  public readonly id = "thread";
  public readonly messageMetadataSchema = undefined;
  public readonly generateMessageId = generateMessageId;
  public readonly spec: ThreadRunSpec;
  public readonly tree: MessageTree<UIMessage>;
  public onData: ThreadRunHost<UIMessage>["onData"];
  public onError: ThreadRunHost<UIMessage>["onError"];
  public onFinish: ThreadRunHost<UIMessage>["onFinish"];
  public onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
  public sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
  public transport: ChatTransport<UIMessage>;
  public status: ChatStatus = "ready";
  public readonly errors: Error[] = [];

  public constructor(
    transport: ChatTransport<UIMessage>,
    initialMessage: UIMessage,
    spec: ThreadRunSpec
  ) {
    this.transport = transport;
    this.spec = spec;
    this.tree = new MessageTree({ messages: [initialMessage] });
  }

  public getMessagePath = (messageId: string | null) =>
    this.tree.getPath(messageId);
  public updateRunPath = (messages: UIMessage[]) => {
    this.tree.updatePath(messages);
  };
  public registerToolCall = registerToolCall;
  public removeMessage = (messageId: string) => this.tree.removeLeaf(messageId);
  public setRunError = (_runId: string, error: Error | undefined) => {
    if (error) {
      this.errors.push(error);
    }
  };
  public setRunStatus = (_runId: string, status: ChatStatus) => {
    this.status = status;
  };
  public writeRunMessage = (_runId: string, message: UIMessage) => {
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
