export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <div
      className="group/message mx-auto w-full max-w-3xl px-4"
      data-role={role}
      data-testid="message-assistant-loading"
    >
      <div className="bg-muted-foreground m-1.5 size-3 animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full motion-reduce:animate-none">
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
};
