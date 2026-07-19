import type {
  CreateWorkspaceResponse,
  HistoryResponse,
  OrganizeMode,
  SceneResponse,
  WorkspacesResponse,
} from "../types/scene";

function withWorkspace(path: string, workspaceId: string): string {
  const params = new URLSearchParams({ workspaceId });
  return `${path}?${params.toString()}`;
}

export async function fetchScene(workspaceId: string): Promise<SceneResponse> {
  const res = await fetch(withWorkspace("/api/scene", workspaceId), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /api/scene failed: ${res.status}`);
  }
  return (await res.json()) as SceneResponse;
}

export async function fetchHistory(workspaceId: string): Promise<HistoryResponse> {
  const res = await fetch(withWorkspace("/api/history", workspaceId), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /api/history failed: ${res.status}`);
  }
  return (await res.json()) as HistoryResponse;
}

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch("/api/workspaces", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GET /api/workspaces failed: ${res.status}`);
  }
  return (await res.json()) as WorkspacesResponse;
}

export async function createWorkspace(name: string): Promise<CreateWorkspaceResponse> {
  const res = await fetch("/api/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/workspaces failed: ${res.status}`);
  }
  return (await res.json()) as CreateWorkspaceResponse;
}

/** 受け取った id をそのまま送る。再送時の冪等性は呼び出し側が同じ id を渡すことで担保する */
export async function postInput(
  workspaceId: string,
  id: string,
  text: string,
  mode: OrganizeMode,
): Promise<void> {
  const res = await fetch("/api/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, id, text, mode }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/input failed: ${res.status}`);
  }
}

export async function postPin(
  workspaceId: string,
  id: string,
  x: number,
  y: number,
  parentId: string | null,
): Promise<void> {
  const res = await fetch("/api/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, id, x, y, parentId }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/pin failed: ${res.status}`);
  }
}
