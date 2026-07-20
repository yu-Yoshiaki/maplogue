import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createWorkspace, fetchHistory, fetchWorkspaces, postInput, postPin } from "./api/client";
import { InputBar, type QuoteInsert } from "./components/InputBar";
import { StatusBadge } from "./components/StatusBadge";
import { CardNode } from "./flow/nodes/CardNode";
import { GroupNode } from "./flow/nodes/GroupNode";
import { ListNode } from "./flow/nodes/ListNode";
import { NoteNode } from "./flow/nodes/NoteNode";
import { TableNode } from "./flow/nodes/TableNode";
import { resolveHereEdgeIds, resolveHereItemIds } from "./here/resolveHereIds";
import { useScenePolling } from "./hooks/useScenePolling";
import { formatItemQuote } from "./quote/formatItemQuote";
import type { HistoryBatch, OrganizeMode, SceneItem, WorkspaceSummary } from "./types/scene";

const nodeTypes: NodeTypes = {
  card: CardNode,
  note: NoteNode,
  list: ListNode,
  table: TableNode,
  group: GroupNode,
};

const DEFAULT_WORKSPACE_ID = "default";
const WORKSPACE_STORAGE_KEY = "realtime-draw.workspaceId";
const HISTORY_OPEN_STORAGE_KEY = "realtime-draw.historyOpen";

function formatDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function WorkspaceBar({
  workspaces,
  activeWorkspaceId,
  newWorkspaceName,
  error,
  creating,
  onSelect,
  onNameChange,
  onCreate,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
  newWorkspaceName: string;
  error: string | null;
  creating: boolean;
  onSelect: (workspaceId: string) => void;
  onNameChange: (name: string) => void;
  onCreate: () => void;
}) {
  return (
    <section className="workspace-bar" aria-label="ワークスペース">
      <select
        value={activeWorkspaceId}
        onChange={(event) => onSelect(event.target.value)}
        aria-label="ワークスペースを選択"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={newWorkspaceName}
        maxLength={40}
        placeholder="新規ワークスペース名"
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCreate();
          }
        }}
      />
      <button type="button" onClick={onCreate} disabled={creating || !newWorkspaceName.trim()}>
        追加
      </button>
      {error && <span className="workspace-error">{error}</span>}
    </section>
  );
}

function HistoryPanel({
  batches,
  error,
  open,
  onToggle,
}: {
  batches: HistoryBatch[];
  error: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const latest = [...batches].reverse();
  return (
    <aside className={`history-panel${open ? " is-open" : " is-closed"}`} aria-label="履歴">
      <div className="history-panel-header">
        <span>履歴</span>
        <div className="history-panel-actions">
          <span>{batches.length}</span>
          <button
            type="button"
            className="history-toggle-btn"
            aria-expanded={open}
            aria-label={open ? "履歴を閉じる" : "履歴を開く"}
            onClick={onToggle}
          >
            {open ? "閉じる" : "開く"}
          </button>
        </div>
      </div>
      {open ? (
        <>
          {error ? <p className="history-empty">{error}</p> : null}
          {!error && latest.length === 0 ? <p className="history-empty">まだ処理履歴はありません</p> : null}
          {!error && latest.length > 0 ? (
            <ol className="history-list">
              {latest.map((batch) => (
                <li key={batch.id} className="history-item">
                  <div className="history-summary">{batch.summary}</div>
                  <div className="history-meta">
                    v{batch.sceneVersionBefore}→v{batch.sceneVersionAfter} / 入力
                    {batch.inputIds.length}件 / {formatDateTime(batch.createdAt)}
                  </div>
                  {batch.changedItemIds.length > 0 && (
                    <div className="history-changes">{batch.changedItemIds.join(", ")}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      ) : null}
    </aside>
  );
}

function EvidencePanel({
  edge,
  onClose,
}: {
  edge: { id: string; label: string; evidence: string } | null;
  onClose: () => void;
}) {
  if (!edge) return null;
  return (
    <aside className="evidence-panel" aria-label="つながりの根拠">
      <div className="evidence-panel-header">
        <span>なぜこの線</span>
        <button type="button" className="evidence-close-btn" onClick={onClose} aria-label="閉じる">
          閉じる
        </button>
      </div>
      {edge.label ? <div className="evidence-label">{edge.label}</div> : null}
      <p className="evidence-body">
        {edge.evidence.trim()
          ? edge.evidence
          : "この線の根拠はまだ記録されていません。次の整理から短い根拠が付くことがあります。"}
      </p>
      <div className="evidence-meta">{edge.id}</div>
    </aside>
  );
}

function decorateFlow(
  nodes: Node[],
  edges: Edge[],
  hereItemIds: readonly string[],
  hereEdgeIds: readonly string[],
  quotedItemId: string | null,
): { nodes: Node[]; edges: Edge[] } {
  const hereItems = new Set(hereItemIds);
  const hereEdges = new Set(hereEdgeIds);
  return {
    nodes: nodes.map((node) => {
      const classes = [
        hereItems.has(node.id) ? "is-here" : "",
        quotedItemId === node.id ? "is-quoted" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return classes ? { ...node, className: classes } : { ...node, className: undefined };
    }),
    edges: edges.map((edge) => {
      if (!hereEdges.has(edge.id)) {
        return { ...edge, className: undefined };
      }
      return {
        ...edge,
        className: "is-here-edge",
        style: { ...(edge.style ?? {}), stroke: "#1150D4", strokeWidth: 2.4 },
      };
    }),
  };
}

function Canvas() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? DEFAULT_WORKSPACE_ID;
  });
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<HistoryBatch[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(() => {
    return window.localStorage.getItem(HISTORY_OPEN_STORAGE_KEY) === "1";
  });
  const [quoteInsert, setQuoteInsert] = useState<QuoteInsert | null>(null);
  const [quotedItemId, setQuotedItemId] = useState<string | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<{
    id: string;
    label: string;
    evidence: string;
  } | null>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, status, bumpPending } =
    useScenePolling(activeWorkspaceId);
  const { fitView } = useReactFlow();
  const didFit = useRef(false);

  const hereItemIds = useMemo(() => resolveHereItemIds(historyBatches), [historyBatches]);
  const hereEdgeIds = useMemo(() => resolveHereEdgeIds(edges, hereItemIds), [edges, hereItemIds]);
  const decorated = useMemo(
    () => decorateFlow(nodes, edges, hereItemIds, hereEdgeIds, quotedItemId),
    [nodes, edges, hereItemIds, hereEdgeIds, quotedItemId],
  );

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, activeWorkspaceId);
    didFit.current = false;
    setSelectedEvidence(null);
    setQuotedItemId(null);
    setQuoteInsert(null);
  }, [activeWorkspaceId]);

  useEffect(() => {
    window.localStorage.setItem(HISTORY_OPEN_STORAGE_KEY, historyOpen ? "1" : "0");
  }, [historyOpen]);

  useEffect(() => {
    let stopped = false;
    void fetchWorkspaces()
      .then((res) => {
        if (stopped) return;
        setWorkspaces(res.workspaces);
        setWorkspaceError(null);
        if (!res.workspaces.some((workspace) => workspace.id === activeWorkspaceId)) {
          setActiveWorkspaceId(DEFAULT_WORKSPACE_ID);
        }
      })
      .catch(() => {
        if (!stopped) setWorkspaceError("ワークスペースを取得できません");
      });
    return () => {
      stopped = true;
    };
  }, [activeWorkspaceId]);

  useEffect(() => {
    let stopped = false;
    const loadHistory = async () => {
      try {
        const res = await fetchHistory(activeWorkspaceId);
        if (stopped) return;
        setHistoryBatches(res.history.batches);
        setHistoryError(null);
      } catch {
        if (!stopped) setHistoryError("履歴を取得できません");
      }
    };
    void loadHistory();
    const timer = setInterval(() => void loadHistory(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [activeWorkspaceId]);

  // 初回ロード時のみ全体を画面に収める（以降のズーム/パンはユーザー操作を尊重）
  useEffect(() => {
    if (!didFit.current && nodes.length > 0) {
      didFit.current = true;
      requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1 }));
    }
  }, [nodes.length, fitView]);

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    void postPin(activeWorkspaceId, node.id, node.position.x, node.position.y, node.parentId ?? null).catch(
      () => {},
    );
  }, [activeWorkspaceId]);

  const handleSubmit = useCallback(
    async (id: string, text: string, mode: OrganizeMode) => {
      await postInput(activeWorkspaceId, id, text, mode);
      bumpPending();
      setQuotedItemId(null);
    },
    [activeWorkspaceId, bumpPending],
  );

  const handleCreateWorkspace = useCallback(async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    setCreatingWorkspace(true);
    try {
      const res = await createWorkspace(name);
      setWorkspaces(res.workspaces);
      setActiveWorkspaceId(res.workspace.id);
      setNewWorkspaceName("");
      setWorkspaceError(null);
    } catch {
      setWorkspaceError("ワークスペースを追加できません");
    } finally {
      setCreatingWorkspace(false);
    }
  }, [newWorkspaceName]);

  const handleNodeClick = useCallback((_event: MouseEvent, node: Node) => {
    const item = (node.data as { item?: SceneItem }).item;
    if (!item) return;
    const quote = formatItemQuote(item);
    setQuotedItemId(item.id);
    setQuoteInsert((prev) => ({
      text: quote,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
    setSelectedEvidence(null);
  }, []);

  const handleEdgeClick = useCallback((_event: MouseEvent, edge: Edge) => {
    const data = (edge.data ?? {}) as { evidence?: string; label?: string };
    setSelectedEvidence({
      id: edge.id,
      label: (typeof edge.label === "string" ? edge.label : data.label) ?? "",
      evidence: data.evidence ?? "",
    });
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEvidence(null);
  }, []);

  return (
    <div className="app">
      <ReactFlow
        nodes={decorated.nodes}
        edges={decorated.edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        minZoom={0.2}
      >
        <Background gap={24} color="#E7D5C6" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <WorkspaceBar
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        newWorkspaceName={newWorkspaceName}
        error={workspaceError}
        creating={creatingWorkspace}
        onSelect={setActiveWorkspaceId}
        onNameChange={setNewWorkspaceName}
        onCreate={() => void handleCreateWorkspace()}
      />
      <header className="scene-title">{status.sceneTitle || "Maplogue"}</header>
      {hereItemIds.length > 0 ? (
        <div className="here-badge" aria-live="polite">
          いまここ · {hereItemIds.length}件
        </div>
      ) : null}
      <HistoryPanel
        batches={historyBatches}
        error={historyError}
        open={historyOpen}
        onToggle={() => setHistoryOpen((value) => !value)}
      />
      <EvidencePanel edge={selectedEvidence} onClose={() => setSelectedEvidence(null)} />
      {status.loaded && status.isEmpty && (
        <div className="empty-hint">
          下の入力欄に思いつくまま書くと、AI が図として整理していきます。
          <br />
          <small>（別ターミナルで監視セッションが動いている必要があります — README 参照）</small>
        </div>
      )}
      <StatusBadge status={status} />
      <InputBar onSubmit={handleSubmit} quoteInsert={quoteInsert} />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
