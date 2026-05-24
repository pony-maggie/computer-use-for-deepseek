import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComputerOverlay } from "./ComputerOverlay";

describe("ComputerOverlay", () => {
  it("renders a scaled point overlay", () => {
    render(
      <ComputerOverlay
        overlay={{
          kind: "point",
          x: 640,
          y: 400,
          label: "left_click",
          displayWidth: 1280,
          displayHeight: 800,
        }}
      />,
    );

    expect(screen.getByText("left_click")).toBeTruthy();
    const point = screen.getByTestId("computer-overlay-point");
    expect(point.style.left).toBe("50%");
    expect(point.style.top).toBe("50%");
  });

  it("renders region, arrow, and scroll overlays", () => {
    const { rerender } = render(
      <ComputerOverlay
        overlay={{
          kind: "region",
          x1: 128,
          y1: 80,
          x2: 256,
          y2: 160,
          label: "zoom",
          displayWidth: 1280,
          displayHeight: 800,
        }}
      />,
    );
    expect(screen.getByTestId("computer-overlay-region")).toBeTruthy();

    rerender(
      <ComputerOverlay
        overlay={{
          kind: "arrow",
          x1: 10,
          y1: 20,
          x2: 30,
          y2: 40,
          label: "drag",
          displayWidth: 1280,
          displayHeight: 800,
        }}
      />,
    );
    expect(screen.getByTestId("computer-overlay-arrow")).toBeTruthy();

    rerender(
      <ComputerOverlay
        overlay={{
          kind: "scroll",
          x: 10,
          y: 20,
          direction: "down",
          label: "scroll",
          displayWidth: 1280,
          displayHeight: 800,
        }}
      />,
    );
    expect(screen.getByTestId("computer-overlay-scroll")).toBeTruthy();
  });
});
