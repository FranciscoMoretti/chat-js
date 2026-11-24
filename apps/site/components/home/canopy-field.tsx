"use client";

import { Check } from "lucide-react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { canopyLayout, visibleCanopyCells } from "./canopy-layout";
import type { FieldPosition, FieldSize } from "./canopy-layout";
import { canopySymbol } from "./canopy-symbol";
import "./canopy-field.css";

interface FieldProps {
  blocks: readonly {
    id: string;
    name: string;
    icon?: string;
    preview?: string;
  }[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

const directions: Partial<Record<string, FieldPosition>> = {
  ArrowDown: { column: 0, row: 1 },
  ArrowLeft: { column: -1, row: 0 },
  ArrowRight: { column: 1, row: 0 },
  ArrowUp: { column: 0, row: -1 },
};

const origin: FieldPosition = { column: 0, row: 0 };
const cellKey = (column: number, row: number) => `${column}:${row}`;

export const CanopyField = ({ blocks, selected, onToggle }: FieldProps) => {
  const field = useRef<HTMLFieldSetElement>(null);
  const instructions = useId();
  const [size, setSize] = useState<FieldSize>({ width: 0, height: 0 });
  const [camera, setCamera] = useState(origin);
  const pendingCamera = useRef(origin);
  const frame = useRef<number | null>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    origin: FieldPosition;
  } | null>(null);
  const moved = useRef(false);
  const focusAfterMove = useRef<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = field.current;
    const measure = () => {
      if (!element) {
        return;
      }
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height }
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (element) {
      observer.observe(element);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  // Browsers may otherwise wrap just the final letter of a long block name.
  // Measure once per catalog/font; resizing and panning only use these ratios.
  const [wordWidths, setWordWidths] = useState<ReadonlyMap<string, number>>(
    () => new Map()
  );
  useEffect(() => {
    let current = true;
    const measureWords = () => {
      const element = field.current;
      const context = document.createElement("canvas").getContext("2d");
      if (!current || !element || !context) {
        return;
      }
      context.font = `480 100px ${getComputedStyle(element).fontFamily}`;
      context.letterSpacing = "-3.5px";
      const widths = blocks.map(({ id, name }): [string, number] => [
        id,
        Math.max(
          ...name.split(/\s+/u).map((word) => context.measureText(word).width)
        ) / 100,
      ]);
      setWordWidths(new Map(widths));
    };
    measureWords();
    const measureFont = async () => {
      await document.fonts.ready;
      measureWords();
    };
    void measureFont();
    return () => {
      current = false;
    };
  }, [blocks]);

  const layout = useMemo(
    () =>
      size.width > 0 && size.height > 0
        ? canopyLayout(size, blocks.length)
        : null,
    [blocks.length, size]
  );
  const pitch = layout?.pitch ?? 1;
  const cells = useMemo(
    () => (layout ? visibleCanopyCells(size, layout, camera) : []),
    [camera, layout, size]
  );
  const activeCell =
    cells.find((cell) => cellKey(cell.column, cell.row) === focused) ??
    cells.toSorted((a, b) => a.index - b.index)[0];
  const moveCamera = useCallback((next: FieldPosition) => {
    pendingCamera.current = next;
    if (frame.current !== null) {
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      setCamera(pendingCamera.current);
    });
  }, []);

  useLayoutEffect(() => {
    if (camera !== pendingCamera.current) {
      return;
    }
    const next = focusAfterMove.current;
    if (next !== null) {
      focusAfterMove.current = null;
      field.current
        ?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)
        ?.focus({ preventScroll: true });
    }
  }, [camera]);

  useEffect(() => {
    const element = field.current;
    const wheel = (event: WheelEvent) => {
      // Vertical wheel and touch gestures continue to scroll the page to its footer.
      if (
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ) {
        return;
      }
      event.preventDefault();
      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;
      moveCamera({
        column: pendingCamera.current.column + (event.deltaX * scale) / pitch,
        row: pendingCamera.current.row,
      });
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => {
      element?.removeEventListener("wheel", wheel);
    };
  }, [pitch, moveCamera]);

  useEffect(
    () => () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
      }
    },
    []
  );

  const start = (event: PointerEvent<HTMLFieldSetElement>) => {
    if (event.button !== 0 || !event.isPrimary) {
      return;
    }
    moved.current = false;
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: pendingCamera.current,
    };
  };
  const move = (event: PointerEvent<HTMLFieldSetElement>) => {
    const startPoint = drag.current;
    if (startPoint?.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (!moved.current) {
      if (Math.hypot(dx, dy) < 7) {
        return;
      }
      if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
        return;
      }
      moved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.panning = "";
    }
    moveCamera({
      column: startPoint.origin.column - dx / pitch,
      row: startPoint.origin.row - dy / pitch,
    });
  };
  const end = (event: PointerEvent<HTMLFieldSetElement>) => {
    if (drag.current?.id === event.pointerId) {
      drag.current = null;
      delete event.currentTarget.dataset.panning;
    }
  };
  const navigate = (
    event: KeyboardEvent<HTMLButtonElement>,
    cell: FieldPosition
  ) => {
    const direction = directions[event.key];
    if (!direction) {
      return;
    }
    event.preventDefault();
    const nextCell = cellKey(
      cell.column + direction.column,
      cell.row + direction.row
    );
    focusAfterMove.current = nextCell;
    setFocused(nextCell);
    moveCamera({
      column: camera.column + direction.column,
      row: camera.row + direction.row,
    });
  };

  const style: CSSProperties & { "--canopy-side": string } = {
    "--canopy-side": `${layout?.side ?? 0}px`,
  };
  return (
    <fieldset
      ref={field}
      className="canopy-field"
      data-canopy-field=""
      aria-label="ChatJS build blocks"
      aria-describedby={instructions}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={(event) => {
        if (event.target === event.currentTarget) {
          end(event);
        }
      }}
      onPointerLeave={(event) => {
        if (!moved.current) {
          end(event);
        }
      }}
      onClickCapture={(event) => {
        if (moved.current && event.detail > 0) {
          event.stopPropagation();
        }
      }}
      style={style}
    >
      <span id={instructions} className="sr-only">
        Drag or use the arrow keys to explore blocks. Press Enter or Space to
        toggle a block.
      </span>
      {cells.map((cell) => {
        const block = blocks.at(cell.index);
        if (!block) {
          return null;
        }
        const side = layout?.side ?? 0;
        const contentWidth =
          side - 2 * Math.min(18, Math.max(4, (side - 75) * 0.17 + 4)) - 3;
        const wordWidth = wordWidths.get(block.id) ?? 1;
        const fontSize = Math.min(
          Math.max(10, side * 0.135),
          18,
          contentWidth / wordWidth
        );
        const key = cellKey(cell.column, cell.row);
        const contour = (((cell.column * 3 + cell.row * 5) % 7) + 7) % 7;
        const tileStyle: CSSProperties & { "--canopy-contour-offset": string } =
          {
            "--canopy-contour-offset": `${(contour / 6) * 100}%`,
            transform: `translate3d(${cell.left}px,${cell.top}px,0)`,
          };
        return (
          <button
            key={key}
            type="button"
            className="canopy-tile"
            data-cell={key}
            data-block-id={block.id}
            data-priority={cell.index + 1}
            aria-pressed={selected.has(block.id)}
            tabIndex={cell === activeCell ? 0 : -1}
            style={tileStyle}
            onFocus={() => {
              setFocused(key);
            }}
            onKeyDown={(event) => {
              navigate(event, cell);
            }}
            onClick={() => {
              onToggle(block.id);
            }}
          >
            <span className="canopy-tile-icon" aria-hidden="true">
              {block.icon === undefined ? (
                canopySymbol(block.id)
              ) : (
                <span
                  className="canopy-brand-icon"
                  style={{ backgroundImage: `url("${block.icon}")` }}
                />
              )}
            </span>
            <span className="canopy-tile-state" aria-hidden="true">
              {selected.has(block.id) && <Check strokeWidth={3} />}
            </span>
            {block.preview !== undefined && (
              <span
                className="canopy-tile-preview"
                aria-hidden="true"
                style={{ backgroundImage: `url("${block.preview}")` }}
              />
            )}
            <span className="canopy-tile-name" style={{ fontSize }}>
              {block.name}
            </span>
          </button>
        );
      })}
    </fieldset>
  );
};
