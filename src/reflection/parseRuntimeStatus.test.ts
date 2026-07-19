import { describe, expect, it } from "vitest";
import { parseSceneWatchRuntimeStatus, toSceneWorkerStatus } from "./parseRuntimeStatus";

describe("parseSceneWatchRuntimeStatus", () => {
  it("正常な runtime status をパースする", () => {
    const parsed = parseSceneWatchRuntimeStatus({
      heartbeatAt: "2026-07-19T12:00:00Z",
      batchStartedAt: "2026-07-19T11:59:00Z",
      batchSucceededAt: null,
      batchFailedAt: null,
      workspaceIds: ["default", "ws_a"],
    });
    expect(parsed).toEqual({
      heartbeatAt: "2026-07-19T12:00:00Z",
      batchStartedAt: "2026-07-19T11:59:00Z",
      batchSucceededAt: null,
      batchFailedAt: null,
      workspaceIds: ["default", "ws_a"],
    });
  });

  it("壊れた status は null（正常フォールバックしない）", () => {
    expect(parseSceneWatchRuntimeStatus({ heartbeatAt: "not-a-date" })).toBeNull();
    expect(
      parseSceneWatchRuntimeStatus({
        heartbeatAt: "2026-07-19T12:00:00Z",
        batchStartedAt: "bad",
        batchSucceededAt: null,
        batchFailedAt: null,
        workspaceIds: ["default"],
      }),
    ).toBeNull();
    expect(parseSceneWatchRuntimeStatus(null)).toBeNull();
  });

  it("選択ワークスペースへ投影する", () => {
    const runtime = parseSceneWatchRuntimeStatus({
      heartbeatAt: "2026-07-19T12:00:00Z",
      batchStartedAt: null,
      batchSucceededAt: null,
      batchFailedAt: null,
      workspaceIds: ["default"],
    });
    expect(toSceneWorkerStatus(runtime, "default")?.includesWorkspace).toBe(true);
    expect(toSceneWorkerStatus(runtime, "other")?.includesWorkspace).toBe(false);
    expect(toSceneWorkerStatus(null, "default")).toBeNull();
  });
});
