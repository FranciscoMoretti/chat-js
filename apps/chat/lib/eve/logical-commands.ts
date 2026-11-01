import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

interface CommandState {
  pending: boolean;
  cancelling: boolean;
  cancellation: number;
  failure?: Error;
}
const idle: CommandState = {
  cancellation: 0,
  cancelling: false,
  pending: false,
};

/** Command locks belong to the execution session, never the selected view. */
export class LogicalCommands {
  private readonly states = new Map<string, CommandState>();
  private readonly listeners = new Set<() => void>();
  public get = (id: string): CommandState => this.states.get(id) ?? idle;
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  public update(
    id: string,
    change: ReadonlyNativeSurface<Partial<CommandState>>
  ): void {
    this.states.set(id, { ...this.get(id), ...change });
    for (const listener of this.listeners) {
      listener();
    }
  }
  public claim(id: string): boolean {
    if (this.get(id).pending) {
      return false;
    }
    this.update(id, { failure: undefined, pending: true });
    return true;
  }
}
