"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const duration = 10;

export const SourceAnimation = () => {
  const frame = useRef<HTMLIFrameElement>(null);
  const time = useRef(0);
  const running = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const seek = useCallback((value: number) => {
    time.current = value;
    frame.current?.contentWindow?.postMessage(
      { type: "chatjs:seek", time: value },
      "*"
    );
    setProgress(value);
  }, []);

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let previous = 0;
    let reflected = 0;
    let request = 0;
    running.current = !reduced.matches;
    setPlaying(running.current);
    if (reduced.matches) {
      seek(duration);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        previous = 0;
      },
      { threshold: 0.15 }
    );
    if (frame.current) {
      observer.observe(frame.current);
    }
    const onReduced = () => {
      if (reduced.matches) {
        running.current = false;
        setPlaying(false);
        seek(duration);
      }
    };
    reduced.addEventListener("change", onReduced);
    const tick = (now: number) => {
      if (previous && visible && running.current && !document.hidden) {
        time.current = Math.min(
          duration,
          time.current + Math.min(64, now - previous) / 1000
        );
        frame.current?.contentWindow?.postMessage(
          { type: "chatjs:seek", time: time.current },
          "*"
        );
        if (now - reflected > 100 || time.current === duration) {
          setProgress(time.current);
          reflected = now;
        }
        if (time.current === duration) {
          running.current = false;
          setPlaying(false);
        }
      }
      previous = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(request);
      observer.disconnect();
      reduced.removeEventListener("change", onReduced);
    };
  }, [seek]);

  const toggle = () => {
    if (time.current >= duration) {
      seek(0);
    }
    running.current = !running.current;
    setPlaying(running.current);
  };

  let playLabel = playing ? "Pause source animation" : "Play source animation";
  if (progress >= duration) {
    playLabel = "Replay source animation";
  }
  let PlayIcon = playing ? Pause : Play;
  let playText = playing ? "Pause" : "Play";
  if (progress >= duration) {
    playText = "Replay";
    PlayIcon = RotateCcw;
  }

  return (
    <>
      <iframe
        sandbox="allow-scripts"
        ref={frame}
        className="source-illustration"
        src="/home/source/index.html"
        loading="lazy"
        title="MCP, Projects and Retrieve URL becoming folders and files in your source tree"
        onLoad={() => {
          seek(time.current);
        }}
      />
      <div className="source-controls">
        <button type="button" onClick={toggle} aria-label={playLabel}>
          {playText} <PlayIcon size={13} aria-hidden="true" />
        </button>
        <label className="scrubber">
          <span className="sr-only">Source animation progress</span>
          <input
            type="range"
            min="0"
            max={duration}
            step="0.01"
            value={progress}
            onChange={(event) => {
              running.current = false;
              setPlaying(false);
              seek(Number(event.target.value));
            }}
          />
        </label>
        <span>{progress.toFixed(1)} / 10s</span>
        <button
          type="button"
          onClick={() => {
            seek(0);
            running.current = true;
            setPlaying(true);
          }}
        >
          Replay <RotateCcw size={13} aria-hidden="true" />
        </button>
      </div>
    </>
  );
};
