import { useEffect, useState } from "react";
import type { SceneStatus } from "../hooks/useScenePolling";
import {
  formatElapsed,
  phaseElapsedSince,
  phaseLabel,
  resolveReflectionPhase,
  type ReflectionPhase,
} from "../reflection/resolveReflectionPhase";

function badgeClass(phase: ReflectionPhase): string {
  switch (phase) {
    case "retry":
    case "watcherStopped":
      return "badge badge-error";
    case "reflected":
      return "badge badge-ok";
    default:
      return "badge badge-busy";
  }
}

function phaseDetail(
  phase: ReflectionPhase,
  status: SceneStatus,
  nowMs: number,
): string | null {
  if (phase === "idle") return null;
  if (phase === "accepted" && status.pending > 0) {
    const base = phaseLabel(phase)!;
    const since = status.submittedAtMs
      ? formatElapsed(new Date(status.submittedAtMs).toISOString(), nowMs)
      : null;
    return since ? `${base} (${status.pending}件・${since})` : `${base} (${status.pending}件)`;
  }
  if (phase === "watcherStopped" && !status.workerStatus) {
    return phaseLabel(phase);
  }
  const sinceIso = phaseElapsedSince(phase, status.workerStatus, status.submittedAtMs);
  const elapsed = formatElapsed(sinceIso, nowMs);
  const label = phaseLabel(phase)!;
  if (phase === "organizing" && status.pending > 0) {
    return elapsed ? `${label} (${status.pending}件・${elapsed})` : `${label} (${status.pending}件)`;
  }
  if (phase === "retry" && status.pending > 0) {
    return elapsed ? `${label} (${status.pending}件・${elapsed})` : `${label} (${status.pending}件)`;
  }
  return elapsed ? `${label} (${elapsed})` : label;
}

export function StatusBadge({ status }: { status: SceneStatus }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const phase = resolveReflectionPhase({
    pending: status.pending,
    justSubmitted: status.justSubmitted,
    workerStatus: status.workerStatus,
    nowMs,
    successVisibleUntilMs: status.successVisibleUntilMs,
  });
  const detail = phaseDetail(phase, status, nowMs);

  return (
    <div className="status-area">
      {status.error && <div className="badge badge-error">{status.error}</div>}
      {status.stale && (
        <div className="badge badge-error">scene.json が不正です — 直前の図を表示中</div>
      )}
      {detail && <div className={badgeClass(phase)}>{detail}</div>}
    </div>
  );
}
