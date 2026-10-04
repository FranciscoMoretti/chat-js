import type { ChatStatus, ChatTransport, UIMessage } from "ai";

import type {
  ThreadRunHost,
  ThreadRunSpec,
} from "#thread-source/ai-sdk-run-chat";
import { MessageTree } from "#thread-source/message-tree";

const generateMessageId = (): string => "client-response";
const registerToolCall: ThreadRunHost<UIMessage>["registerToolCall"] =
  (): void => {
    /* This host fixture does not persist tool-call registrations. */
  };

export class TestRunHost implements ThreadRunHost<UIMessage> {
  public readonly dataPartSchemas: undefined;
  public readonly id = "thread";
  public readonly messageMetadataSchema: undefined;
  public readonly generateMessageId = generateMessageId;
  public readonly spec: ThreadRunSpec;
  public readonly tree: MessageTree;
  public onData: ThreadRunHost<UIMessage>["onData"];
  public onError: ThreadRunHost<UIMessage>["onError"];
  public onFinish: ThreadRunHost<UIMessage>["onFinish"];
  public onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
  public sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
  public transport: ChatTransport<UIMessage>;
  public status: ChatStatus = "ready";
  public readonly errors: Error[] = [];

  public constructor(
    transport: Readonly<ChatTransport<UIMessage>>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree construction receives the original canonical SDK message; readonly nested parts cannot satisfy its native message type.
    initialMessage: Readonly<UIMessage>,
    spec: Readonly<ThreadRunSpec>
  ) {
    this.transport = transport;
    this.spec = spec;
    this.tree = new MessageTree({ messages: [initialMessage] });
  }

  public getMessagePath = (messageId: string | null): UIMessage[] =>
    this.tree.getPath(messageId);
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.updatePath receives canonical SDK messages; readonly nested parts cannot satisfy its native message array, while the outer array is readonly.
  public updateRunPath = (messages: readonly Readonly<UIMessage>[]): void => {
    this.tree.updatePath(messages);
  };
  public registerToolCall = registerToolCall;
  public removeMessage = (messageId: string): void =>
    this.tree.removeLeaf(messageId);
  public setRunError = (
    _runId: string,
    error: Readonly<Error> | undefined
  ): void => {
    if (error) {
      this.errors.push(error);
    }
  };
  public setRunStatus = (_runId: string, status: ChatStatus): void => {
    this.status = status;
  };
  public writeRunMessage = (
    _runId: string,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- MessageTree.upsertMessage receives the original canonical SDK response; readonly nested parts cannot satisfy its native stored-message type.
    message: Readonly<UIMessage>
  ): void => {
    if (
      typeof this.spec.messageId === "string" &&
      this.spec.messageId !== "" &&
      this.spec.messageId !== message.id
    ) {
      throw new Error("Run message identity changed");
    }
    if (
      !(
        typeof this.spec.messageId === "string" && this.spec.messageId !== ""
      ) &&
      this.tree.has(message.id)
    ) {
      throw new Error("Run message identity already exists");
    }
    this.spec.messageId = message.id;
    this.tree.upsertMessage(message, this.spec.parentMessageId);
  };
}
