import { AbstractThread, type ThreadState } from "@chatjs/thread";
import type { ChatMessage } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";

export class ApplicationThread extends AbstractThread<ChatMessage> {
  constructor({ id, state }: { id: string; state: ThreadState<ChatMessage> }) {
    super({ generateId: generateUUID, id, state });
  }
}
