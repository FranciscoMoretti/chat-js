type CommandState = {
  pending: boolean;
  cancelling: boolean;
  cancellation: number;
  failure?: Error;
};
const idle: CommandState = {
  cancellation: 0,
  cancelling: false,
  pending: false,
};

/** Command locks belong to the execution session, never the selected view. */
export class LogicalCommands {
  private states = new Map<string, CommandState>();
  private listeners = new Set<() => void>();
  get = (id: string) => this.states.get(id) ?? idle;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(id: string, change: Partial<CommandState>) {
    this.states.set(id, { ...this.get(id), ...change });
    for (const listener of this.listeners) {
      listener();
    }
  }
  claim(id: string) {
    if (this.get(id).pending) {
      return false;
    }
    this.update(id, { failure: undefined, pending: true });
    return true;
  }
}
