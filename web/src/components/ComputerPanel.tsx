import type { CSSProperties } from "react";
import { ComputerOverlay } from "./ComputerOverlay";
import type { ViewportPreset } from "./advancedControls";
import type { OverlayModel } from "./runEventView";

type Props = {
  overlay?: OverlayModel | null;
  viewport: ViewportPreset;
  viewportStatus: string;
};

export function ComputerPanel({ overlay = null, viewport, viewportStatus }: Props) {
  return (
    <div
      className="sandbox-viewport-frame"
      data-viewport={viewport.id}
      style={{ "--viewport-aspect": `${viewport.width} / ${viewport.height}` } as CSSProperties}
    >
      <div className="sandbox-viewport-badge">
        <strong>{viewport.label}</strong>
        <span>{viewportStatus}</span>
      </div>
      <section className="panel computer-panel">
        <iframe
          title="Sandbox computer"
          src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
        />
        <ComputerOverlay overlay={overlay} />
      </section>
    </div>
  );
}
