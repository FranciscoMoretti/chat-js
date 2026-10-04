import type { ChatTransport, UIMessage } from "ai";

import type { ThreadRunHost } from "./ai-sdk-run-chat";

type RunHostSource<TMessage extends UIMessage> = Pick<
  ThreadRunHost<TMessage>,
  | "dataPartSchemas"
  | "id"
  | "messageMetadataSchema"
  | "onData"
  | "onError"
  | "onFinish"
  | "onToolCall"
  | "sendAutomaticallyWhen"
  | "transport"
>;
type RunHostOperations<TMessage extends UIMessage> = Readonly<
  Pick<
    ThreadRunHost<TMessage>,
    | "generateMessageId"
    | "getMessagePath"
    | "registerToolCall"
    | "removeMessage"
    | "setRunError"
    | "setRunStatus"
    | "updateRunPath"
    | "writeRunMessage"
  >
>;

class ThreadRunHostAdapter<
  TMessage extends UIMessage,
> implements ThreadRunHost<TMessage> {
  readonly #source: RunHostSource<TMessage>;
  public readonly generateMessageId: ThreadRunHost<TMessage>["generateMessageId"];
  public readonly getMessagePath: ThreadRunHost<TMessage>["getMessagePath"];
  public readonly registerToolCall: ThreadRunHost<TMessage>["registerToolCall"];
  public readonly removeMessage: ThreadRunHost<TMessage>["removeMessage"];
  public readonly setRunError: ThreadRunHost<TMessage>["setRunError"];
  public readonly setRunStatus: ThreadRunHost<TMessage>["setRunStatus"];
  public readonly updateRunPath: ThreadRunHost<TMessage>["updateRunPath"];
  public readonly writeRunMessage: ThreadRunHost<TMessage>["writeRunMessage"];

  public constructor(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This live source retains native SDK schema instances and receives callback/transport setter writes; recursive readonly schemas cannot satisfy their original SDK contract.
    source: RunHostSource<TMessage>,
    operations: RunHostOperations<TMessage>
  ) {
    this.#source = source;
    this.generateMessageId = operations.generateMessageId;
    this.getMessagePath = operations.getMessagePath;
    this.registerToolCall = operations.registerToolCall;
    this.removeMessage = operations.removeMessage;
    this.setRunError = operations.setRunError;
    this.setRunStatus = operations.setRunStatus;
    this.updateRunPath = operations.updateRunPath;
    this.writeRunMessage = operations.writeRunMessage;
  }

  public get dataPartSchemas(): ThreadRunHost<TMessage>["dataPartSchemas"] {
    return this.#source.dataPartSchemas;
  }

  public get id(): ThreadRunHost<TMessage>["id"] {
    return this.#source.id;
  }

  public get messageMetadataSchema(): ThreadRunHost<TMessage>["messageMetadataSchema"] {
    return this.#source.messageMetadataSchema;
  }

  public get onData(): ThreadRunHost<TMessage>["onData"] {
    return this.#source.onData;
  }

  public set onData(value: ThreadRunHost<TMessage>["onData"]) {
    this.#source.onData = value;
  }

  public get onError(): ThreadRunHost<TMessage>["onError"] {
    return this.#source.onError;
  }

  public set onError(value: ThreadRunHost<TMessage>["onError"]) {
    this.#source.onError = value;
  }

  public get onFinish(): ThreadRunHost<TMessage>["onFinish"] {
    return this.#source.onFinish;
  }

  public set onFinish(value: ThreadRunHost<TMessage>["onFinish"]) {
    this.#source.onFinish = value;
  }

  public get onToolCall(): ThreadRunHost<TMessage>["onToolCall"] {
    return this.#source.onToolCall;
  }

  public set onToolCall(value: ThreadRunHost<TMessage>["onToolCall"]) {
    this.#source.onToolCall = value;
  }

  public get sendAutomaticallyWhen(): ThreadRunHost<TMessage>["sendAutomaticallyWhen"] {
    return this.#source.sendAutomaticallyWhen;
  }

  public set sendAutomaticallyWhen(
    value: ThreadRunHost<TMessage>["sendAutomaticallyWhen"]
  ) {
    this.#source.sendAutomaticallyWhen = value;
  }

  public get transport(): ThreadRunHost<TMessage>["transport"] {
    return this.#source.transport;
  }

  public set transport(value: Readonly<ChatTransport<TMessage>>) {
    this.#source.transport = value;
  }
}

export { ThreadRunHostAdapter };
