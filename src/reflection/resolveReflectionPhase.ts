// マップ反映状況の表示状態を、API worker status / pending / 送信直後フラグから純粋に判定する。

import type { SceneWorkerStatus } from "../types/scene";

/** heartbeat がこれより古いと監視停止とみなす（daemon の poll は 2 秒） */
export const HEARTBEAT_STALE_MS = 10_000;

/** 反映済みバッジを出す時間 */
export const SUCCESS_VISIBLE_MS = 4_000;

export type ReflectionPhase =
  | "idle"
  | "accepted"
  | "organizing"
  | "retry"
  | "watcherStopped"
  | "reflected";

export interface ResolveReflectionPhaseInput {
  pending: number;
  /** 送信成功直後で、まだ API の pending が追いついていないとき true */
  justSubmitted: boolean;
  workerStatus: SceneWorkerStatus | null;
  nowMs: number;
  /** pending が 0 になったあとに反映済みを出す期限（epoch ms）。無しは null */
  successVisibleUntilMs: number | null;
  heartbeatStaleMs?: number;
}

export function isBatchInProgress(worker: SceneWorkerStatus): boolean {
  if (!worker.batchStartedAt) return false;
  const started = Date.parse(worker.batchStartedAt);
  if (!Number.isFinite(started)) return false;
  const succeeded = worker.batchSucceededAt ? Date.parse(worker.batchSucceededAt) : 0;
  const failed = worker.batchFailedAt ? Date.parse(worker.batchFailedAt) : 0;
  const succeededMs = Number.isFinite(succeeded) ? succeeded : 0;
  const failedMs = Number.isFinite(failed) ? failed : 0;
  return started > succeededMs && started > failedMs;
}

export function isLastBatchFailed(worker: SceneWorkerStatus): boolean {
  if (!worker.batchFailedAt) return false;
  const failed = Date.parse(worker.batchFailedAt);
  if (!Number.isFinite(failed)) return false;
  if (!worker.batchSucceededAt) return true;
  const succeeded = Date.parse(worker.batchSucceededAt);
  if (!Number.isFinite(succeeded)) return true;
  return failed > succeeded;
}

export function isHeartbeatStale(
  worker: SceneWorkerStatus | null,
  nowMs: number,
  staleMs: number = HEARTBEAT_STALE_MS,
): boolean {
  if (!worker?.heartbeatAt) return true;
  const at = Date.parse(worker.heartbeatAt);
  if (!Number.isFinite(at)) return true;
  return nowMs - at > staleMs;
}

/**
 * 選択中ワークスペース向けの表示フェーズを返す。
 * API error / scene stale は呼び出し側で別表示する。
 */
export function resolveReflectionPhase(input: ResolveReflectionPhaseInput): ReflectionPhase {
  const staleMs = input.heartbeatStaleMs ?? HEARTBEAT_STALE_MS;
  const hasWork = input.pending > 0 || input.justSubmitted;

  if (hasWork) {
    if (isHeartbeatStale(input.workerStatus, input.nowMs, staleMs)) {
      return "watcherStopped";
    }
    const worker = input.workerStatus!;
    if (isBatchInProgress(worker) && worker.includesWorkspace) {
      return "organizing";
    }
    if (isLastBatchFailed(worker) && worker.includesWorkspace && input.pending > 0) {
      return "retry";
    }
    return "accepted";
  }

  if (
    input.successVisibleUntilMs !== null &&
    input.nowMs < input.successVisibleUntilMs
  ) {
    return "reflected";
  }

  return "idle";
}

/** 経過時間を短い自然表記にする（秒 / 分） */
export function formatElapsed(fromIso: string | null | undefined, nowMs: number): string {
  if (!fromIso) return "";
  const from = Date.parse(fromIso);
  if (!Number.isFinite(from) || nowMs < from) return "0秒";
  const sec = Math.floor((nowMs - from) / 1000);
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分`;
  const hour = Math.floor(min / 60);
  return `${hour}時間`;
}

export function phaseLabel(phase: ReflectionPhase): string | null {
  switch (phase) {
    case "accepted":
      return "受付済み";
    case "organizing":
      return "AI整理中";
    case "retry":
      return "再試行/失敗";
    case "watcherStopped":
      return "監視が停止しています";
    case "reflected":
      return "反映済み";
    case "idle":
      return null;
  }
}

export function phaseElapsedSince(
  phase: ReflectionPhase,
  worker: SceneWorkerStatus | null,
  submittedAtMs: number | null,
): string | null {
  switch (phase) {
    case "accepted":
      return submittedAtMs !== null ? new Date(submittedAtMs).toISOString() : worker?.heartbeatAt ?? null;
    case "organizing":
      return worker?.batchStartedAt ?? null;
    case "retry":
      return worker?.batchFailedAt ?? null;
    case "watcherStopped":
      return worker?.heartbeatAt ?? null;
    case "reflected":
      return worker?.batchSucceededAt ?? null;
    default:
      return null;
  }
}
