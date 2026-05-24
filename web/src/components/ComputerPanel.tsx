import { ComputerOverlay } from "./ComputerOverlay";
import type { OverlayModel } from "./runEventView";

type Props = {
  overlay?: OverlayModel | null;
};

export function ComputerPanel({ overlay = null }: Props) {
  return (
    <section className="panel computer-panel">
      <iframe
        title="Sandbox computer"
        src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
      />
      <ComputerOverlay overlay={overlay} />
    </section>
  );
}
