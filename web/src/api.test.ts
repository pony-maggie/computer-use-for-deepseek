import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun, getApiHealth, interpretVoice } from "./api";

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

  it("posts voice transcripts for model interpretation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        task_text_delta: "打开浏览器，访问 baidu.com",
        actions: ["create_run", "start_run"],
        manual_confirmation_required: false,
        message: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await interpretVoice({
      transcript: "打开浏览器，访问 baidu.com，开始运行",
      language: "zh-CN",
      current_task: "",
      run_status: "created",
      has_pending_confirmation: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/voice/interpret",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
