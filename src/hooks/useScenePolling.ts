// 1.5秒間隔で /api/scene をポーリングし、変更を React Flow の state に差分反映する。
// 「図が暴れない」ための規則:
//   - scene.version と pins が両方とも前回と同じなら何もしない（再レンダーもしない）
//   - 既存ノードは parentId が変わらないときだけ現在の position を維持し、data を差し替える
//   - parentId が変わったノードは fresh の layout/pin 座標を使う（座標系混在を防ぐ）
//   - 新規ノードだけ autoLayout の計算座標で追加する
//   - pins は parentId が現在の所属と一致するときだけ最優先
// pending 件数や stale フラグは version に依存せず毎ティック更新する。

import { useEdgesState, useNodesState, type Edge, type Node } from "@xyflow/react";
import { useCallback, useEffect, useState } from "react";
import { fetchScene } from "../api/client";
import { toFlow } from "../flow/toFlow";
import { SUCCESS_VISIBLE_MS } from "../reflection/resolveReflectionPhase";
import type { Pins, Scene, SceneWorkerStatus } from "../types/scene";

export interface SceneStatus {
  pending: number;
  stale: boolean;
  error: string | null;
  sceneTitle: string;
  isEmpty: boolean;
  loaded: boolean;
  workerStatus: SceneWorkerStatus | null;
  /** 送信成功直後で API の pending がまだ 0 のとき true */
  justSubmitted: boolean;
  /** 直近の送信成功時刻（epoch ms）。無いとき null */
  submittedAtMs: number | null;
  /** 反映済み表示の期限（epoch ms）。無いとき null */
  successVisibleUntilMs: number | null;
}

const INITIAL_STATUS: SceneStatus = {
  pending: 0,
  stale: false,
  error: null,
  sceneTitle: "",
  isEmpty: true,
  loaded: false,
  workerStatus: null,
  justSubmitted: false,
  submittedAtMs: null,
  successVisibleUntilMs: null,
};

/**
 * fresh nodes に対し、parentId が一致する既存ノードの position だけを引き継ぐ。
 * pin の parentId が現在の所属と一致するときは fresh（toFlow 適用済み）を優先する。
 */
export function mergeNodePositions(prev: Node[], fresh: Node[], pins: Pins): Node[] {
  const prevById = new Map(prev.map((n) => [n.id, n]));
  return fresh.map((node) => {
    const pin = pins[node.id];
    const currentParentId = node.parentId ?? null;
    if (pin && pin.parentId === currentParentId) return node;
    const old = prevById.get(node.id);
    if (old && (old.parentId ?? null) === currentParentId) {
      return { ...node, position: old.position };
    }
    return node;
  });
}

export function useScenePolling(workspaceId: string, intervalMs = 1500) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [status, setStatus] = useState<SceneStatus>(INITIAL_STATUS);

  const applyScene = useCallback(
    (scene: Scene, pins: Pins) => {
      const fresh = toFlow(scene, pins);
      setNodes((prev) => mergeNodePositions(prev, fresh.nodes, pins));
      setEdges(fresh.edges);
    },
    [setNodes, setEdges],
  );

  /** 入力送信直後に「受付済み」を即時点灯させる（次のポーリングで実数に置き換わる） */
  const bumpPending = useCallback(() => {
    const now = Date.now();
    setStatus((s) => ({
      ...s,
      pending: Math.max(s.pending, 1),
      justSubmitted: true,
      submittedAtMs: now,
    }));
  }, []);

  useEffect(() => {
    setNodes([]);
    setEdges([]);
    setStatus(INITIAL_STATUS);
  }, [workspaceId, setNodes, setEdges]);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    let lastVersion = 0;
    let lastPinsJson = "";
    let lastPending = 0;

    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const res = await fetchScene(workspaceId);
        if (stopped) return;
        const pinsJson = JSON.stringify(res.pins);
        if (res.scene.version !== lastVersion || pinsJson !== lastPinsJson) {
          lastVersion = res.scene.version;
          lastPinsJson = pinsJson;
          applyScene(res.scene, res.pins);
        }

        const pending = res.pendingInputs;
        const now = Date.now();
        setStatus((prev) => {
          let successVisibleUntilMs = prev.successVisibleUntilMs;
          const becameClear =
            (lastPending > 0 || prev.justSubmitted || prev.pending > 0) && pending === 0;
          if (becameClear) {
            successVisibleUntilMs = now + SUCCESS_VISIBLE_MS;
          } else if (pending > 0) {
            successVisibleUntilMs = null;
          } else if (successVisibleUntilMs !== null && now >= successVisibleUntilMs) {
            successVisibleUntilMs = null;
          }

          return {
            pending,
            stale: res.stale ?? false,
            error: null,
            sceneTitle: res.scene.title,
            isEmpty: res.scene.items.length === 0,
            loaded: true,
            workerStatus: res.workerStatus ?? null,
            // 送信直後フラグは最初の成功ポーリングで落とす（pending 局所値は API 値に置換）
            justSubmitted: false,
            submittedAtMs: pending > 0 ? prev.submittedAtMs : null,
            successVisibleUntilMs,
          };
        });
        lastPending = pending;
      } catch {
        if (!stopped) {
          setStatus((s) => ({ ...s, error: "サーバーに接続できません" }));
        }
      } finally {
        busy = false;
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [workspaceId, intervalMs, applyScene]);

  return { nodes, edges, onNodesChange, onEdgesChange, status, bumpPending };
}
