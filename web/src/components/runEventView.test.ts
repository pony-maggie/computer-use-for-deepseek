import { describe, expect, it } from "vitest";
import type { RunEvent } from "../types";
import { createOverlayModel, summarizeRunEvent } from "./runEventView";

const display = { width: 1280, height: 800, scale: 1 };

describe("runEventView", () => {
  it("summarizes structured events", () => {
    expect(
      summarizeRunEvent({
        kind: "tool",
        message: "executing",
        tool_name: "computer",
        action_name: "left_click",
      }),
    ).toBe("computer: left_click");
  });

  it("creates a point overlay for click actions", () => {
    expect(
      createOverlayModel({
        kind: "tool",
        message: "click",
        tool_name: "computer",
        action_name: "left_click",
        action_payload: { coordinate: [320, 240] },
        display,
      }),
    ).toMatchObject({ kind: "point", x: 320, y: 240 });
  });

  it("creates drag, scroll, and region overlays", () => {
    const drag: RunEvent = {
      kind: "tool",
      message: "drag",
      tool_name: "computer",
      action_name: "drag",
      action_payload: { coordinate: [10, 20], end_coordinate: [30, 40] },
      display,
    };
    const scroll: RunEvent = {
      kind: "tool",
      message: "scroll",
      tool_name: "computer",
      action_name: "scroll",
      action_payload: { coordinate: [10, 20], scroll_direction: "down" },
      display,
    };
    const zoom: RunEvent = {
      kind: "tool",
      message: "zoom",
      tool_name: "computer",
      action_name: "zoom",
      action_payload: { region: [10, 20, 30, 40] },
      display,
    };

    expect(createOverlayModel(drag)).toMatchObject({ kind: "arrow" });
    expect(createOverlayModel(scroll)).toMatchObject({ kind: "scroll" });
    expect(createOverlayModel(zoom)).toMatchObject({ kind: "region" });
  });

  it("returns null for legacy events", () => {
    expect(createOverlayModel({ kind: "created", message: "Run created" })).toBeNull();
  });
});
