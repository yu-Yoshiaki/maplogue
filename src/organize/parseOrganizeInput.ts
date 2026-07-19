import type { OrganizeMode } from "../types/scene";

export const ORGANIZE_MODE_OPTIONS: ReadonlyArray<{ mode: OrganizeMode; label: string }> = [
  { mode: "normal", label: "通常" },
  { mode: "todo", label: "TODO" },
  { mode: "discussion", label: "議論" },
  { mode: "compare", label: "比較" },
];

const COMMAND_TO_MODE: Readonly<Record<string, OrganizeMode>> = {
  "/normal": "normal",
  "/todo": "todo",
  "/discuss": "discussion",
  "/discussion": "discussion",
  "/compare": "compare",
  "/通常": "normal",
  "/タスク": "todo",
  "/議論": "discussion",
  "/比較": "compare",
};

export interface SlashParseResult {
  overrideMode: OrganizeMode | null;
  body: string;
  emptyBody: boolean;
}

export interface OrganizeSubmitResolution {
  mode: OrganizeMode;
  text: string;
  emptyBody: boolean;
}

function resolveCommand(token: string): OrganizeMode | null {
  return COMMAND_TO_MODE[token] ?? COMMAND_TO_MODE[token.toLowerCase()] ?? null;
}

export function parseOrganizeSlashCommand(raw: string): SlashParseResult {
  const started = raw.trimStart();
  if (!started) {
    return { overrideMode: null, body: "", emptyBody: true };
  }

  const match = started.match(/^(\/[^\s]+)(\s+|$)/);
  if (!match) {
    const body = started.trim();
    return { overrideMode: null, body, emptyBody: body.length === 0 };
  }

  const overrideMode = resolveCommand(match[1]);
  if (!overrideMode) {
    const body = started.trim();
    return { overrideMode: null, body, emptyBody: body.length === 0 };
  }

  const body = started.slice(match[0].length).trim();
  return { overrideMode, body, emptyBody: body.length === 0 };
}

export function resolveOrganizeSubmit(
  raw: string,
  selectedMode: OrganizeMode,
): OrganizeSubmitResolution {
  const parsed = parseOrganizeSlashCommand(raw);
  return {
    mode: parsed.overrideMode ?? selectedMode,
    text: parsed.body,
    emptyBody: parsed.emptyBody,
  };
}
