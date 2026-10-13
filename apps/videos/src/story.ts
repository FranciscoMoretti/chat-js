const FPS = 30;

const DURATION = 48;

type PathId = "city" | "food";

type ReplyState = "streaming" | "stopped" | "complete";

type CaptionBeat = Readonly<{ end: number; label: string; start: number }>;

type CursorMove = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type StoryState = Readonly<{
  answer: string;
  budget: boolean;
  editText: string;
  edited: boolean;
  editing: boolean;
  family: boolean;
  following: boolean;
  followup: Readonly<{
    prompt: string;
    reply: string;
    state: "streaming" | "complete";
    text: string;
    title: string;
  }>;
  foodVisible: boolean;
  note: string;
  portoAnswer: string;
  portoState: "streaming" | "complete";
  reveal: number;
  selected: PathId;
  states: Readonly<Record<PathId, ReplyState>>;
  texts: Readonly<Record<PathId, string>>;
}>;

interface LaunchScript {
  readonly budget: {
    readonly prompt: string;
    readonly reply: string;
    readonly title: string;
  };
  readonly city: { readonly label: string; readonly text: string };
  readonly family: {
    readonly prompt: string;
    readonly reply: string;
    readonly title: string;
  };
  readonly food: { readonly label: string; readonly text: string };
  readonly package: string;
  readonly porto: {
    readonly label: string;
    readonly preservedNote: string;
    readonly prompt: string;
    readonly reply: string;
    readonly title: string;
  };
  readonly prompt: string;
  readonly title: string;
  readonly url: string;
}

const script = {
  budget: {
    prompt: "Make it vegetarian.",
    reply: "Try vegetable petiscos, market salads, and a vegetarian tasca.",
    title: "Vegetarian",
  },
  city: {
    label: "City sights",
    text: "Saturday — Explore Alfama, then ride tram 28.\n\nSunday — Visit Belém and watch the sunset by the river.",
  },
  family: {
    prompt: "Make it kid-friendly.",
    reply: "Try the aquarium, a park picnic, and an ice cream stop.",
    title: "With the kids",
  },
  food: {
    label: "Food trip",
    text: "Saturday — Try the pastries and visit the food market.\n\nSunday — Find a local tasca for lunch, then share petiscos.",
  },
  package: "@chat-js/thread",
  porto: {
    label: "Porto",
    preservedNote: "Both Lisbon conversations kept",
    prompt: "Plan a weekend in Porto.",
    reply:
      "Saturday — Explore Ribeira and walk across the Dom Luís I Bridge.\n\nSunday — Visit the gardens, then catch the sunset by the river.",
    title: "Porto weekend",
  },
  prompt: "Plan a weekend in Lisbon.",
  title: "Lisbon weekend",
  url: "chatjs.dev/threads",
} satisfies LaunchScript;

const beats: readonly Readonly<{
  at: number;
  subtitle: string;
  title: string;
}>[] = [
  {
    at: 0,
    subtitle: "Regenerate. Switch answers. Keep chatting.",
    title: "Branching conversations for AI SDK",
  },
  {
    at: 48.5,
    subtitle: "An npm package for your AI SDK app.",
    title: "Add branching to your chat",
  },
];

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

const ease = (value: number): number => {
  const clamped = clamp(value);
  return clamped * clamped * (3 - 2 * clamped);
};

const textAt = (text: string, fraction: number): string =>
  text.slice(0, Math.floor(clamp(fraction) * text.length));
const editTextAt = (timeSeconds: number, content: LaunchScript): string => {
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
  if (timeSeconds < 42.6) {
    return content.prompt;
  }
  return `${editPrefix}${textAt(editSuffix, (timeSeconds - 42.6) / 1.1)}`;
};

const noteAt = (timeSeconds: number): string => {
  let note = "";
  if (timeSeconds >= 22) {
    note = "Both paths are yours to keep.";
  } else if (timeSeconds >= 12 && timeSeconds < 18) {
    note = "One prompt. Two answers.";
  } else if (timeSeconds >= 19 && timeSeconds < 22) {
    note = "Your original is here. The other reply keeps going.";
  }
  return note;
};

const stateAt = (time: number, content: LaunchScript = script): StoryState => {
  let selected: PathId = "city";
  if (time >= 12.2 && time < 19) {
    selected = "food";
  }
  if (time >= 19 && time < 33) {
    selected = "city";
  }
  if (time >= 33) {
    selected = "food";
  }
  const editing = time >= 42.2 && time < 44.8;
  const edited = time >= 44.8;
  const following = time >= 24 && time < 41.5;
  const family = time >= 24 && time < 33;
  const budget = time >= 34;
  const followup = family ? content.family : content.budget;
  const progress = clamp((time - (family ? 24.6 : 34.6)) / 2.4);
  const texts: Readonly<Record<PathId, string>> = {
    city: textAt(content.city.text, (time - 3.5) / 3),
    food: textAt(content.food.text, (time - 12.2) / 10),
  };
  const states: Readonly<Record<PathId, ReplyState>> = {
    city: time < 6.5 ? "streaming" : "complete",
    food: time < 22.2 ? "streaming" : "complete",
  };
  return {
    answer: texts[selected],
    budget,
    editText: editTextAt(time, content),
    edited,
    editing,
    family,
    following: following && (family || budget),
    followup: {
      ...followup,
      state: progress < 1 ? ("streaming" as const) : ("complete" as const),
      text: textAt(followup.reply, progress),
    },
    foodVisible: time >= 12.2,
    note: noteAt(time),
    portoAnswer: textAt(content.porto.reply, (time - 45) / 2.5),
    portoState: time < 47.5 ? ("streaming" as const) : ("complete" as const),
    reveal: ease((time - 11.5) / 0.3),
    selected,
    states,
    texts,
  };
};

const captionBeats: readonly CaptionBeat[] = [
  { end: 11.5, label: "Try another answer", start: 10 },
  { end: 18, label: "Switch while replies stream", start: 16.5 },
  { end: 24, label: "Continue either conversation", start: 22.5 },
  { end: 32, label: "Continue the other", start: 30.5 },
  { end: 41.5, label: "Edit any message. Keep both versions.", start: 40 },
] as const;

const presentationAt = (
  wallTime: number
):
  | { caption: null; demoTime: number; opacity: number }
  | { caption: string; demoTime: number; opacity: number } => {
  // Cut only completed-reply holds; keep action and streaming speed unchanged.
  const time =
    wallTime +
    (wallTime >= 8 ? 2 : 0) +
    (wallTime >= 26.5 ? 2 : 0) +
    (wallTime >= 34.5 ? 1.5 : 0);
  const beat = captionBeats.find(
    (captionBeat): boolean =>
      time >= captionBeat.start && time < captionBeat.end
  );
  if (!beat) {
    return { caption: null, demoTime: time, opacity: 0 };
  }
  const elapsed = time - beat.start;
  const duration = beat.end - beat.start;
  return {
    caption: beat.label,
    demoTime: beat.start,
    opacity: Math.min(ease(elapsed / 0.15), ease((duration - elapsed) / 0.15)),
  };
};

const cursorAt = (timeSeconds: number): { x: number; y: number } | null => {
  const moves: readonly CursorMove[] = [
    [11.5, 12.5, 0.2, 600, 740, 178, 716],
    [18.1, 19.5, 0.4, 600, 740, 178, 716],
    [32.1, 33.5, 0.4, 600, 620, 249, 572],
    [41.5, 42.4, 0.3, 600, 620, 964, 522],
    [44, 45.1, 0.3, 650, 620, 962, 555],
  ];
  const move = moves.find(
    ([start, end]): boolean => timeSeconds >= start && timeSeconds < end
  );
  if (!move) {
    return null;
  }
  const [start, , duration, startX, startY, endX, endY] = move;
  const progress = ease((timeSeconds - start) / duration);
  return {
    x: startX + (endX - startX) * progress,
    y: startY + (endY - startY) * progress,
  };
};
export {
  beats,
  captionBeats,
  clamp,
  cursorAt,
  DURATION,
  ease,
  FPS,
  presentationAt,
  script,
  stateAt,
};
export type { LaunchScript, PathId, ReplyState, StoryState };
