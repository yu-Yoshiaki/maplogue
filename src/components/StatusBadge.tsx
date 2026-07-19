import type { SceneStatus } from "../hooks/useScenePolling";

export function StatusBadge({ status }: { status: SceneStatus }) {
  return (
    <div className="status-area">
      {status.error && <div className="badge badge-error">{status.error}</div>}
      {status.stale && (
        <div className="badge badge-error">scene.json が不正です — 直前の図を表示中</div>
      )}
      {status.pending > 0 && <div className="badge badge-busy">整理中… ({status.pending}件)</div>}
    </div>
  );
}
