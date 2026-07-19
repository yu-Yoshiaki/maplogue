import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  HEARTBEAT_STALE_MS,
  isBatchInProgress,
  isHeartbeatStale,
  isLastBatchFailed,
  phaseLabel,
  resolveReflectionPhase,
} from "./resolveReflectionPhase";
import type { SceneWorkerStatus } from "../types/scene";

function worker(partial: Partial<SceneWorkerStatus> = {}): SceneWorkerStatus {
  return {
    heartbeatAt: "2026-07-19T12:00:00Z",
    batchStartedAt: null,
    batchSucceededAt: null,
    batchFailedAt: null,
    includesWorkspace: true,
    ...partial,
  };
}

describe("resolveReflectionPhase", () => {
  const now = Date.parse("2026-07-19T12:00:05Z");

  it("送信直後は受付済み", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: true,
        workerStatus: worker(),
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("accepted");
  });

  it("pending がありバッチ未開始なら受付済み", () => {
    expect(
      resolveReflectionPhase({
        pending: 2,
        justSubmitted: false,
        workerStatus: worker({ includesWorkspace: false }),
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("accepted");
  });

  it("選択ワークスペースのバッチ進行中は AI整理中", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: false,
        workerStatus: worker({
          batchStartedAt: "2026-07-19T12:00:01Z",
          batchSucceededAt: null,
          batchFailedAt: null,
          includesWorkspace: true,
        }),
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("organizing");
  });

  it("直近バッチ失敗かつ pending 残は再試行/失敗", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: false,
        workerStatus: worker({
          batchStartedAt: "2026-07-19T11:59:00Z",
          batchSucceededAt: "2026-07-19T11:58:00Z",
          batchFailedAt: "2026-07-19T11:59:30Z",
          includesWorkspace: true,
        }),
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("retry");
  });

  it("監視未起動で pending があると監視停止", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: false,
        workerStatus: null,
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("watcherStopped");
  });

  it("heartbeat が古いと監視停止", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: false,
        workerStatus: worker({ heartbeatAt: "2026-07-19T11:59:00Z" }),
        nowMs: now,
        successVisibleUntilMs: null,
        heartbeatStaleMs: HEARTBEAT_STALE_MS,
      }),
    ).toBe("watcherStopped");
  });

  it("バッチ進行中でも heartbeat が新しければ監視停止にしない", () => {
    expect(
      resolveReflectionPhase({
        pending: 1,
        justSubmitted: false,
        workerStatus: worker({
          heartbeatAt: "2026-07-19T12:00:04Z",
          batchStartedAt: "2026-07-19T11:59:00Z",
          batchSucceededAt: null,
          batchFailedAt: null,
          includesWorkspace: true,
        }),
        nowMs: now,
        successVisibleUntilMs: null,
      }),
    ).toBe("organizing");
  });

  it("pending 0 の成功ウィンドウ中は反映済み", () => {
    expect(
      resolveReflectionPhase({
        pending: 0,
        justSubmitted: false,
        workerStatus: worker({ batchSucceededAt: "2026-07-19T12:00:04Z" }),
        nowMs: now,
        successVisibleUntilMs: now + 3_000,
      }),
    ).toBe("reflected");
  });

  it("成功ウィンドウ終了後は idle", () => {
    expect(
      resolveReflectionPhase({
        pending: 0,
        justSubmitted: false,
        workerStatus: worker(),
        nowMs: now,
        successVisibleUntilMs: now - 1,
      }),
    ).toBe("idle");
  });
});

describe("batch helpers", () => {
  it("開始が成功/失敗より新しければ進行中", () => {
    expect(
      isBatchInProgress(
        worker({
          batchStartedAt: "2026-07-19T12:00:02Z",
          batchSucceededAt: "2026-07-19T12:00:01Z",
          batchFailedAt: null,
        }),
      ),
    ).toBe(true);
  });

  it("失敗が成功より新しければ last failed", () => {
    expect(
      isLastBatchFailed(
        worker({
          batchSucceededAt: "2026-07-19T11:00:00Z",
          batchFailedAt: "2026-07-19T12:00:00Z",
        }),
      ),
    ).toBe(true);
  });

  it("heartbeat 欠落は stale", () => {
    expect(isHeartbeatStale(null, Date.now())).toBe(true);
  });
});

describe("display helpers", () => {
  it("formatElapsed は秒と分を返す", () => {
    const now = Date.parse("2026-07-19T12:01:05Z");
    expect(formatElapsed("2026-07-19T12:01:00Z", now)).toBe("5秒");
    expect(formatElapsed("2026-07-19T12:00:00Z", now)).toBe("1分");
  });

  it("phaseLabel は想定文言を返す", () => {
    expect(phaseLabel("accepted")).toBe("受付済み");
    expect(phaseLabel("organizing")).toBe("AI整理中");
    expect(phaseLabel("retry")).toBe("再試行/失敗");
    expect(phaseLabel("watcherStopped")).toBe("監視が停止しています");
    expect(phaseLabel("reflected")).toBe("反映済み");
    expect(phaseLabel("idle")).toBeNull();
  });
});
