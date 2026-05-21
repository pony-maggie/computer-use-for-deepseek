import { describe, expect, it } from "vitest";
import { getRunControlState } from "./runControlState";

describe("getRunControlState", () => {
  it("only allows starting a created run", () => {
    expect(getRunControlState("created", true).canStart).toBe(true);
    expect(getRunControlState("waiting_for_confirmation", true).canStart).toBe(false);
    expect(getRunControlState("completed", true).canStart).toBe(false);
  });

  it("disables every run action while another action is pending", () => {
    expect(getRunControlState("created", true, "start")).toMatchObject({
      canStart: false,
      canPause: false,
      canResume: false,
      canCancel: false,
      canApprove: false,
      canReject: false,
    });
  });

  it("maps pause resume and cancel to valid run states", () => {
    expect(getRunControlState("running", true)).toMatchObject({
      canPause: true,
      canResume: false,
      canCancel: true,
    });
    expect(getRunControlState("paused", true)).toMatchObject({
      canPause: false,
      canResume: true,
      canCancel: true,
    });
    expect(getRunControlState("completed", true)).toMatchObject({
      canPause: false,
      canResume: false,
      canCancel: false,
    });
  });

  it("allows approve and reject only while waiting for confirmation", () => {
    expect(getRunControlState("waiting_for_confirmation", true)).toMatchObject({
      canApprove: true,
      canReject: true,
    });
    expect(getRunControlState("running", true)).toMatchObject({
      canApprove: false,
      canReject: false,
    });
  });
});
