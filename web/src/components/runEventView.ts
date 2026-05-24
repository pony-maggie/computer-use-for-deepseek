import type { Run, RunEvent } from "../types";

export type OverlayModel =
  | {
      kind: "point";
      x: number;
      y: number;
      label: string;
      displayWidth: number;
      displayHeight: number;
    }
  | {
      kind: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      displayWidth: number;
      displayHeight: number;
    }
  | {
      kind: "scroll";
      x: number;
      y: number;
      direction: string;
      label: string;
      displayWidth: number;
      displayHeight: number;
    }
  | {
      kind: "region";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      label: string;
      displayWidth: number;
      displayHeight: number;
    };

function numberPair(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  return typeof x === "number" && typeof y === "number" ? [x, y] : null;
}

function numberRegion(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  return value.every((item) => typeof item === "number")
    ? (value as [number, number, number, number])
    : null;
}

export function eventDomId(event: RunEvent, index: number): string {
  return event.id ?? `${event.kind}-${event.sequence ?? index}`;
}

export function summarizeRunEvent(event: RunEvent): string {
  if (event.tool_name && event.action_name) return `${event.tool_name}: ${event.action_name}`;
  if (event.step && event.kind) return `Step ${event.step}: ${event.kind}`;
  return event.message;
}

export function createOverlayModel(event: RunEvent | null | undefined): OverlayModel | null {
  if (!event || event.tool_name !== "computer" || !event.action_payload || !event.display) {
    return null;
  }

  const action = event.action_name;
  const coordinate = numberPair(event.action_payload.coordinate);
  const endCoordinate = numberPair(event.action_payload.end_coordinate);
  const region = numberRegion(event.action_payload.region);
  const base = {
    displayWidth: event.display.width,
    displayHeight: event.display.height,
  };

  if (
    ["left_click", "double_click", "right_click", "middle_click", "mouse_move"].includes(
      action ?? "",
    ) &&
    coordinate
  ) {
    return { kind: "point", x: coordinate[0], y: coordinate[1], label: action ?? "point", ...base };
  }
  if (action === "drag" && coordinate && endCoordinate) {
    return {
      kind: "arrow",
      x1: coordinate[0],
      y1: coordinate[1],
      x2: endCoordinate[0],
      y2: endCoordinate[1],
      label: "drag",
      ...base,
    };
  }
  if (action === "scroll" && coordinate) {
    return {
      kind: "scroll",
      x: coordinate[0],
      y: coordinate[1],
      direction: String(event.action_payload.scroll_direction ?? "down"),
      label: "scroll",
      ...base,
    };
  }
  if (action === "zoom" && region) {
    return {
      kind: "region",
      x1: region[0],
      y1: region[1],
      x2: region[2],
      y2: region[3],
      label: "zoom",
      ...base,
    };
  }
  return null;
}

export function buildRunReport(run: Run | null, events: RunEvent[]) {
  const screenshotEvents = events.filter((event) => event.screenshot?.hash);
  const errors = events.filter(
    (event) =>
      event.kind === "error" ||
      event.error ||
      event.status === "failed" ||
      event.status === "blocked",
  );
  return {
    finalText: run?.final_text ?? null,
    steps: run?.steps ?? 0,
    totalTokens: run?.total_tokens ?? 0,
    promptCacheHitTokens: run?.prompt_cache_hit_tokens ?? 0,
    estimatedCostUsd: run?.estimated_cost_usd ?? 0,
    screenshotCount: screenshotEvents.length,
    errorCount: errors.length,
  };
}
