import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun, getApiHealth } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("returns false when the backend health check cannot connect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(getApiHealth()).resolves.toBe(false);
  });

  it("turns network failures into a user-facing startup message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(createRun("open example.com")).rejects.toThrow(
      "Backend API is still starting or is unreachable",
    );
  });
});
