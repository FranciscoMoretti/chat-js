export const FPS = 30;
export const DURATION = 48;
export type PathId = "city" | "food";
export type ReplyState = "streaming" | "stopped" | "complete";
export const script = {
  title: "Lisbon weekend",
  prompt: "Plan a weekend in Lisbon.",
  package: "@chat-js/thread",
  url: "chatjs.dev/threads",
  city: {
    label: "City sights",
    text: "Saturday — Explore Alfama, then ride tram 28.\n\nSunday — Visit Belém and watch the sunset by the river.",
  },
  food: {
    label: "Food trip",
    text: "Saturday — Try the pastries and visit the food market.\n\nSunday — Find a local tasca for lunch, then share petiscos.",
  },
  family: {
    prompt: "Make it kid-friendly.",
    title: "With the kids",
    reply: "Try the aquarium, a park picnic, and an ice cream stop.",
  },
  porto: {
    title: "Porto weekend",
    label: "Porto",
    preservedNote: "Both Lisbon conversations kept",
    prompt: "Plan a weekend in Porto.",
    reply:
      "Saturday — Explore Ribeira and walk across the Dom Luís I Bridge.\n\nSunday — Visit the gardens, then catch the sunset by the river.",
  },
  budget: {
    prompt: "Make it vegetarian.",
    title: "Vegetarian",
    reply: "Try vegetable petiscos, market salads, and a vegetarian tasca.",
  },
};
export type LaunchScript = typeof script;
export const beats = [
  {
    at: 0,
    title: "Branching conversations for AI SDK",
    subtitle: "Regenerate. Switch answers. Keep chatting.",
  },
  {
    at: 48.5,
    title: "Add branching to your chat",
    subtitle: "An npm package for your AI SDK app.",
  },
];
export const clamp = (x: number) => Math.max(0, Math.min(1, x));
export const ease = (x: number) => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};
const textAt = (text: string, fraction: number) =>
  text.slice(0, Math.floor(clamp(fraction) * text.length));
export const stateAt = (t: number, content: LaunchScript = script) => {
  let prefixLength = 0;
  while (
    prefixLength < content.prompt.length &&
    prefixLength < content.porto.prompt.length &&
    content.prompt[prefixLength] === content.porto.prompt[prefixLength]
  ) {
    prefixLength += 1;
  }
  const editPrefix = content.porto.prompt.slice(0, prefixLength);
  const editSuffix = content.porto.prompt.slice(prefixLength);
  const selected: PathId =
    t >= 33 ? "food" : t >= 19 ? "city" : t >= 12.2 ? "food" : "city";
  const editing = t >= 42.2 && t < 44.8;
  const edited = t >= 44.8;
  const following = t >= 24 && t < 41.5;
  const family = t >= 24 && t < 33;
  const budget = t >= 34;
  const followup = family ? content.family : content.budget;
  const progress = clamp((t - (family ? 24.6 : 34.6)) / 2.4);
  const texts = {
    city: textAt(content.city.text, (t - 3.5) / 3),
    food: textAt(content.food.text, (t - 12.2) / 10),
  };
  const states: Record<PathId, ReplyState> = {
    city: t < 6.5 ? "streaming" : "complete",
    food: t < 22.2 ? "streaming" : "complete",
  };
  return {
    selected,
    editing,
    edited,
    editText:
      t < 42.6
        ? content.prompt
        : `${editPrefix}${textAt(editSuffix, (t - 42.6) / 1.1)}`,
    portoAnswer: textAt(content.porto.reply, (t - 45) / 2.5),
    portoState: t < 47.5 ? ("streaming" as const) : ("complete" as const),
    following: following && (family || budget),
    family,
    budget,
    foodVisible: t >= 12.2,
    reveal: ease((t - 11.5) / 0.3),
    texts,
    states,
    answer: texts[selected],
    followup: {
      ...followup,
      text: textAt(followup.reply, progress),
      state: progress < 1 ? ("streaming" as const) : ("complete" as const),
    },
    note:
      t >= 19 && t < 22
        ? "Your original is here. The other reply keeps going."
        : t >= 12 && t < 18
          ? "One prompt. Two answers."
          : t >= 22
            ? "Both paths are yours to keep."
            : "",
  };
};
export type StoryState = ReturnType<typeof stateAt>;
export const captionBeats = [
  { start: 10, end: 11.5, label: "Try another answer" },
  { start: 16.5, end: 18, label: "Switch while replies stream" },
  { start: 22.5, end: 24, label: "Continue either conversation" },
  { start: 30.5, end: 32, label: "Continue the other" },
  { start: 40, end: 41.5, label: "Edit any message. Keep both versions." },
];
export const presentationAt = (wallTime: number) => {
  // Cut only completed-reply holds; keep action and streaming speed unchanged.
  const time =
    wallTime +
    (wallTime >= 8 ? 2 : 0) +
    (wallTime >= 26.5 ? 2 : 0) +
    (wallTime >= 34.5 ? 1.5 : 0);
  const beat = captionBeats.find((b) => time >= b.start && time < b.end);
  if (!beat) return { demoTime: time, caption: null, opacity: 0 };
  const elapsed = time - beat.start;
  const duration = beat.end - beat.start;
  return {
    demoTime: beat.start,
    caption: beat.label,
    opacity: Math.min(ease(elapsed / 0.15), ease((duration - elapsed) / 0.15)),
  };
};
export const cursorAt = (t: number) => {
  const moves = [
    [11.5, 12.5, 0.2, 600, 740, 178, 716],
    [18.1, 19.5, 0.4, 600, 740, 178, 716],
    [32.1, 33.5, 0.4, 600, 620, 249, 572],
    [41.5, 42.4, 0.3, 600, 620, 964, 522],
    [44, 45.1, 0.3, 650, 620, 962, 555],
  ];
  const move = moves.find(([start, end]) => t >= start && t < end);
  if (!move) return null;
  const [start, , duration, ax, ay, bx, by] = move;
  const k = ease((t - start) / duration);
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k };
};
