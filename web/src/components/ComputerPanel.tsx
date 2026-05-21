export function ComputerPanel() {
  return (
    <section className="panel computer-panel">
      <iframe
        title="Sandbox computer"
        src="http://localhost:6080/vnc.html?autoconnect=true&resize=scale"
      />
    </section>
  );
}
