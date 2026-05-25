import { afterEach, describe, expect, it, vi } from "vitest";
import { createRun, getApiHealth, interpretVoice, listRuns, setSandboxViewport } from "./api";

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

  it("fetches run history", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          run_id: "run_123",
          task: "open example.com",
          status: "completed",
          final_text: "Done",
          created_at: "2026-05-23T10:00:00+00:00",
          updated_at: "2026-05-23T10:01:00+00:00",
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const history = await listRuns();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/runs",
      { cache: "no-store" },
    );
    expect(history[0].task).toBe("open example.com");
  });

  it("posts sandbox viewport changes to the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        width: 390,
        height: 844,
        label: "Mobile 390x844",
        applied: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await setSandboxViewport({ width: 390, height: 844, label: "Mobile 390x844" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/sandbox/viewport",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ width: 390, height: 844, label: "Mobile 390x844" }),
      }),
    );
  });
});
