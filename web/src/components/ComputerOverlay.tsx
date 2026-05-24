import type { CSSProperties } from "react";
import type { OverlayModel } from "./runEventView";

type Props = {
  overlay: OverlayModel | null;
};

function pct(value: number, total: number) {
  return `${Math.max(0, Math.min(100, (value / total) * 100))}%`;
}

export function ComputerOverlay({ overlay }: Props) {
  if (!overlay) return null;

  if (overlay.kind === "point") {
    return (
      <div className="computer-overlay" aria-label="Selected action overlay">
        <div
          data-testid="computer-overlay-point"
          className="overlay-point"
          style={{
            left: pct(overlay.x, overlay.displayWidth),
            top: pct(overlay.y, overlay.displayHeight),
          }}
        >
          <span>{overlay.label}</span>
        </div>
      </div>
    );
  }

  if (overlay.kind === "region") {
    return (
      <div className="computer-overlay" aria-label="Selected action overlay">
        <div
          data-testid="computer-overlay-region"
          className="overlay-region"
          style={{
            left: pct(overlay.x1, overlay.displayWidth),
            top: pct(overlay.y1, overlay.displayHeight),
            width: pct(overlay.x2 - overlay.x1, overlay.displayWidth),
            height: pct(overlay.y2 - overlay.y1, overlay.displayHeight),
          }}
        >
          <span>{overlay.label}</span>
        </div>
      </div>
    );
  }

  if (overlay.kind === "arrow") {
    return (
      <div className="computer-overlay" aria-label="Selected action overlay">
        <div
          data-testid="computer-overlay-arrow"
          className="overlay-arrow"
          style={{
            left: pct(overlay.x1, overlay.displayWidth),
            top: pct(overlay.y1, overlay.displayHeight),
            "--overlay-end-x": pct(overlay.x2, overlay.displayWidth),
            "--overlay-end-y": pct(overlay.y2, overlay.displayHeight),
          } as CSSProperties}
        >
          <span>{overlay.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="computer-overlay" aria-label="Selected action overlay">
      <div
        data-testid="computer-overlay-scroll"
        className={`overlay-scroll ${overlay.direction}`}
        style={{
          left: pct(overlay.x, overlay.displayWidth),
          top: pct(overlay.y, overlay.displayHeight),
        }}
      >
        <span>{overlay.label}</span>
      </div>
    </div>
  );
}
