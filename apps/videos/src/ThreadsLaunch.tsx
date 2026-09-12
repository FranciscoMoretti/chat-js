import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Logo } from "./shared/brand";
import { Caption, ClickPulse, Pointer } from "./shared/presentation";
import {
  beats,
  cursorAt,
  DURATION,
  ease,
  presentationAt,
  stateAt,
} from "./story";
import type { LaunchScript, ReplyState, StoryState } from "./story";

import "./styles.css";

const Author = () => (
  <>
    <div className="avatar">
      <Logo />
    </div>
    Assistant
  </>
);
const Status = ({
  state,
  t,
  background = false,
}: {
  state: ReplyState;
  t: number;
  background?: boolean;
}) => (
  <>
    {state === "streaming" ? (
      <>
        <span className="ring" style={{ transform: `rotate(${t * 300}deg)` }} />{" "}
        {background ? "Still streaming" : "Streaming"}
      </>
    ) : state === "stopped" ? (
      "■ Stopped"
    ) : (
      "✓ Complete"
    )}
  </>
);
const ActionIcon = ({
  name,
}: {
  name: "edit" | "copy" | "previous" | "next" | "regenerate";
}) => {
  const paths = {
    copy: "M9 9h12v12H9z M5 15H3V3h12v2",
    edit: "M16 3a2.83 2.83 0 0 1 4 4L7 20l-5 1 1-5Z M14.5 4.5l4 4",
    next: "m9 18 6-6-6-6",
    previous: "m15 18-6-6 6-6",
    regenerate:
      "M20 7v5h-5 M4 17v-5h5 M6.1 7a7 7 0 0 1 11.6-2L20 8 M4 16l2.3 3A7 7 0 0 0 17.9 17",
  };
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
};
const MessageActions = ({
  user = false,
  index = 1,
  count = 1,
  streaming = false,
  className = "",
  regenerateHint = false,
  actionTime = 0,
}: {
  user?: boolean;
  index?: number;
  count?: number;
  streaming?: boolean;
  className?: string;
  regenerateHint?: boolean;
  actionTime?: number;
}) => (
  <div className={`messageActions ${className}`}>
    {user && (
      <span
        className={`messageAction ${actionTime >= 41.8 && actionTime < 42.2 ? "highlightAction" : ""}`}
        title="Edit message"
      >
        <ActionIcon name="edit" />
      </span>
    )}
    {count > 1 && (
      <>
        <span
          className={`messageAction ${actionTime >= 18.5 && actionTime < 19 ? "highlightAction" : ""}`}
          style={{ opacity: index === 1 ? 0.3 : 1 }}
        >
          <ActionIcon name="previous" />
        </span>
        <span className="versionCount">
          {index} / {count}
        </span>
        <span
          className={`messageAction ${actionTime >= 32.5 && actionTime < 33 ? "highlightAction" : ""}`}
          style={{ opacity: index === count ? 0.3 : 1 }}
        >
          <ActionIcon name="next" />
        </span>
      </>
    )}
    {!user && !streaming && (
      <span
        className={`messageAction regenerateAction ${regenerateHint ? "highlightAction" : ""}`}
      >
        <ActionIcon name="regenerate" />
        {regenerateHint && (
          <span className="actionTooltip">Regenerate response</span>
        )}
      </span>
    )}
    {!streaming && (
      <span className="messageAction" title="Copy">
        <ActionIcon name="copy" />
      </span>
    )}
  </div>
);
const Chat = ({
  s,
  t,
  content,
}: {
  s: StoryState;
  t: number;
  content: LaunchScript;
}) => (
  <div
    className={`chat ${s.following ? "following" : ""}`}
    style={{ left: 320 - 236 * s.reveal, width: 1120 - 160 * s.reveal }}
  >
    <div className="chatheader">
      {s.edited ? content.porto.title : content.title}
      <span className="pathlabel">
        {s.edited ? content.porto.label : content[s.selected].label}
      </span>
    </div>
    <div className="messages">
      <div className="user">
        <div className="role">You</div>
        <div className={`bubble ${s.editing ? "editingBubble" : ""}`}>
          {s.editing
            ? s.editText
            : s.edited
              ? content.porto.prompt
              : content.prompt}
          {s.editing && <span className="editCaret">|</span>}
        </div>
        {s.editing && (
          <div className="editControls">
            <span>Cancel</span>
            <button
              type="button"
              className={t >= 44.3 ? "highlightAction" : ""}
            >
              Save
            </button>
          </div>
        )}
        {!s.editing && (
          <MessageActions
            user
            className="promptActions"
            actionTime={t}
            index={2}
            count={s.edited ? 2 : 1}
          />
        )}
      </div>
      <div className="assistant" style={{ opacity: s.editing ? 0.25 : 1 }}>
        <div className="author">
          <Author />
          {!s.following && (
            <span
              className="assistantStatus"
              style={{
                color:
                  s.states[s.selected] === "stopped" ? "#f3ba6a" : "#89bda9",
              }}
            >
              <Status
                state={s.edited ? s.portoState : s.states[s.selected]}
                t={t}
              />
            </span>
          )}
        </div>
        <div className="answer" style={{ fontSize: 24 }}>
          {s.edited ? s.portoAnswer : s.answer}
        </div>
        <MessageActions
          className="replyActions"
          regenerateHint={t >= 11.65 && t < 12.2}
          actionTime={t}
          index={s.selected === "city" ? 1 : 2}
          count={!s.edited && s.foodVisible ? 2 : 1}
          streaming={
            s.edited
              ? s.portoState === "streaming"
              : !s.following && s.states[s.selected] === "streaming"
          }
        />
      </div>
    </div>
    {s.following && (
      <div className="followup" style={{ display: "block" }}>
        <div className="followupUser">
          <div className="role">You</div>
          <div className="bubble">{s.followup.prompt}</div>
          <MessageActions user className="followupPromptActions" />
        </div>
        <div className="author">
          <Author />
          <span className="followupStatus">
            <Status state={s.followup.state} t={t} />
          </span>
        </div>
        <div className="followupAnswer">{s.followup.text}</div>
        <MessageActions
          className="followupReplyActions"
          streaming={s.followup.state === "streaming"}
        />
      </div>
    )}
    <div className="composer">
      Message this branch… <span>↑</span>
    </div>
  </div>
);
const ConversationTree = ({
  s,
  t,
  content,
}: {
  s: StoryState;
  t: number;
  content: LaunchScript;
}) => (
  <div className="map" style={{ opacity: s.reveal }}>
    <div className="maptitle">YOUR CONVERSATION</div>
    <div
      style={{
        height: 640,
        left: 0,
        position: "absolute",
        top: 0,
        transform: `translateY(${100 * ease((t - 44.8) / 0.5)}px) scale(${1 - 0.38 * ease((t - 44.8) / 0.5)})`,
        transformOrigin: "top left",
        width: 735,
      }}
    >
      <svg
        aria-hidden="true"
        width="735"
        height="640"
        style={{ position: "absolute", top: 0 }}
      >
        {(["city", "food"] as const).map((id) => {
          const x = id === "city" ? 176 : 560;
          return (
            (id === "city" || s.foodVisible) && (
              <path
                key={id}
                d={`M367 171 V235 Q367 249 ${id === "city" ? 353 : 381} 249 H${x} V322`}
                fill="none"
                stroke={!s.edited && s.selected === id ? "#83b2ff" : "#404040"}
                strokeWidth={3}
              />
            )
          );
        })}
        {t >= 24 && (
          <path
            d="M176 464 V514"
            fill="none"
            stroke={!s.edited && s.family ? "#83b2ff" : "#404040"}
            strokeWidth={3}
          />
        )}
        {s.budget && (
          <path
            d="M560 464 V514"
            fill="none"
            stroke={!s.edited && s.selected === "food" ? "#83b2ff" : "#404040"}
            strokeWidth={3}
          />
        )}
      </svg>
      <div className="node root">
        <span>{content.prompt}</span>
      </div>
      {(["city", "food"] as const).map(
        (id) =>
          (id === "city" || s.foodVisible) && (
            <div
              key={id}
              className={`node ${!s.edited && s.selected === id ? "selected" : ""} ${s.states[id] === "streaming" ? "live" : ""}`}
              style={{ left: id === "city" ? 35 : 419, top: 322, width: 282 }}
            >
              {!s.edited && s.selected === id && !s.following && (
                <div className="badge">Viewing this path</div>
              )}
              <div className="nodetitle">{content[id].label}</div>
              <div className="nodestatus">
                <Status
                  state={s.states[id]}
                  t={t}
                  background={s.selected !== id}
                />
              </div>
              <div className="count">
                {s.states[id] === "streaming"
                  ? `${s.texts[id].trim().split(/\s+/u).filter(Boolean).length} words generated`
                  : id === "city"
                    ? "Original answer"
                    : "Alternative answer"}
              </div>
              {s.states[id] === "streaming" && (
                <div className="streamProgress">
                  <i
                    style={{
                      width: `${(100 * s.texts[id].length) / content[id].text.length}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )
      )}
      {t >= 24 && (
        <div
          className={`followupNode ${!s.edited && s.family ? "selected" : ""}`}
          style={{ left: 35, width: 282 }}
        >
          <div className="nodetitle">{content.family.title}</div>
          <div className="nodestatus">City follow-up</div>
        </div>
      )}
      {s.budget && (
        <div
          className={`followupNode ${!s.edited && s.selected === "food" ? "selected" : ""}`}
          style={{ left: 419, width: 282 }}
        >
          <div className="nodetitle">{content.budget.title}</div>
          <div className="nodestatus">Food follow-up</div>
        </div>
      )}
    </div>
    {s.edited && (
      <div style={{ opacity: ease((t - 44.8) / 0.5) }}>
        <svg
          aria-hidden="true"
          width="735"
          height="640"
          style={{ position: "absolute", top: 0 }}
        >
          <path
            d="M228 153 V70 H600 V185 M600 271 V375"
            fill="none"
            stroke="#83b2ff"
            strokeWidth={3}
          />
        </svg>
        <div className="node selected portoPrompt">
          <span>{content.porto.prompt}</span>
        </div>
        <div
          className={`node selected portoReply ${s.portoState === "streaming" ? "live" : ""}`}
        >
          <div className="nodetitle">{content.porto.title}</div>
          <div className="nodestatus">
            <Status state={s.portoState} t={t} />
          </div>
          <div className="count">New conversation</div>
        </div>
        <div className="preservedLabel">{content.porto.preservedNote}</div>
      </div>
    )}
    {t < 24 && !s.following && !s.edited && (
      <div className="mapnote">{s.note}</div>
    )}
  </div>
);
export const ThreadsLaunch = ({ content }: { content: LaunchScript }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const wallTime = frame / fps;
  const presentation = presentationAt(wallTime);
  const t = presentation.demoTime;
  const s = stateAt(t, content);
  const cursor = cursorAt(t);
  return (
    <AbsoluteFill className="stage">
      <div className="brand">
        <Logo />
        ChatJS Threads
      </div>
      <div className="eyebrow">NPM PACKAGE / COMPATIBLE WITH AI SDK</div>
      <div className="demoStage">
        <Chat s={s} t={t} content={content} />
        <ConversationTree s={s} t={t} content={content} />
        {[
          { at: 11.85, x: 178, y: 716 },
          { at: 18.8, x: 178, y: 716 },
          { at: 32.8, x: 249, y: 572 },
          { at: 41.9, x: 964, y: 522 },
          { at: 44.5, x: 962, y: 555 },
        ].map(({ at, x, y }) => (
          <ClickPulse key={at} age={t - at} x={x} y={y} />
        ))}
        {cursor && <Pointer {...cursor} />}
      </div>
      {presentation.caption && (
        <Caption opacity={presentation.opacity}>{presentation.caption}</Caption>
      )}

      <div className="footer">ILLUSTRATED WALKTHROUGH · SIMULATED REPLIES</div>
      <div className="url">{content.url}</div>
      <div className="progress">
        <i style={{ width: `${(wallTime / DURATION) * 100}%` }} />
      </div>
      <Sequence
        name="Package introduction"
        durationInFrames={3 * fps}
        layout="none"
      >
        <div className="package" style={{ opacity: 1 - ease((t - 2.7) / 0.3) }}>
          <div className="kicker">
            <Logo />
            CHATJS THREADS
          </div>
          <h2>{beats[0].title}</h2>
          <p>{beats[0].subtitle}</p>
          <code>{content.package}</code>
          <small>An npm package for your app.</small>
        </div>
      </Sequence>
      <Sequence name="Install and call to action" from={43 * fps} layout="none">
        <div className="outro" style={{ opacity: ease((t - 48.5) / 0.4) }}>
          <div className="glyph">
            <Logo />
          </div>
          <h2>{beats.at(-1)?.title}</h2>
          <p>{beats.at(-1)?.subtitle}</p>
          <code>npm install {content.package}</code>
          <strong>{content.url}</strong>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
