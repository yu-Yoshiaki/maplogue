import { useEffect, useRef, useState } from "react";
import { ORGANIZE_MODE_OPTIONS, resolveOrganizeSubmit } from "../organize/parseOrganizeInput";
import { appendQuoteToText } from "../quote/formatItemQuote";
import type { OrganizeMode } from "../types/scene";

function createInboxId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `in_${randomUuid.replaceAll("-", "").slice(0, 16)}`;

  const randomValues = globalThis.crypto?.getRandomValues?.(new Uint8Array(8));
  if (randomValues) {
    return `in_${Array.from(randomValues, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `in_${time}${random}`;
}

/**
 * 1回の送信試行。失敗時は同じ id を pending として残し、成功時だけクリアする。
 * InputBar の冪等再送契約を unit test 可能にするための薄いヘルパー。
 */
export async function attemptSubmit(args: {
  pendingId: string | null;
  text: string;
  mode: OrganizeMode;
  onSubmit: (id: string, text: string, mode: OrganizeMode) => Promise<void>;
  createId?: () => string;
}): Promise<{ pendingId: string | null; text: string; ok: boolean; id: string }> {
  const id = args.pendingId ?? (args.createId ?? createInboxId)();
  try {
    await args.onSubmit(id, args.text, args.mode);
    return { pendingId: null, text: "", ok: true, id };
  } catch {
    return { pendingId: id, text: args.text, ok: false, id };
  }
}

export type QuoteInsert = {
  text: string;
  nonce: number;
};

export function InputBar({
  onSubmit,
  quoteInsert = null,
}: {
  onSubmit: (id: string, text: string, mode: OrganizeMode) => Promise<void>;
  /** ノードクリック由来の引用。nonce が変わったときだけ追記する */
  quoteInsert?: QuoteInsert | null;
}) {
  const [text, setText] = useState("");
  const [selectedMode, setSelectedMode] = useState<OrganizeMode>("normal");
  const [sending, setSending] = useState(false);
  // 失敗後・同一本文の再送で同じ id を使う。本文変更または成功時にクリアする
  const [pendingId, setPendingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastQuoteNonce = useRef(0);

  useEffect(() => {
    if (!quoteInsert || quoteInsert.nonce === lastQuoteNonce.current) return;
    lastQuoteNonce.current = quoteInsert.nonce;
    setText((prev) => appendQuoteToText(prev, quoteInsert.text));
    setPendingId(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    });
  }, [quoteInsert]);

  const resolved = resolveOrganizeSubmit(text, selectedMode);
  const canSubmit = !resolved.emptyBody && !sending;

  const submit = async () => {
    if (!canSubmit) return;
    const rawForRetry = text;
    setSending(true);
    try {
      const result = await attemptSubmit({
        pendingId,
        text: resolved.text,
        mode: resolved.mode,
        onSubmit,
      });
      setPendingId(result.pendingId);
      // 失敗時はスラッシュ付き原文を残し、再送でも同じ上書きが効くようにする
      setText(result.ok ? "" : rawForRetry);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="input-bar">
      <div className="organize-mode-bar" role="group" aria-label="整理モード">
        {ORGANIZE_MODE_OPTIONS.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className={`organize-mode-btn${selectedMode === mode ? " is-selected" : ""}`}
            aria-pressed={selectedMode === mode}
            onClick={() => {
              setSelectedMode(mode);
              setPendingId(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="input-hint">ノードをクリックすると、修正したい対象を引用できます</p>
      <div className="input-bar-row">
        <textarea
          ref={textareaRef}
          value={text}
          rows={2}
          placeholder="思いつくまま書いて Enter（Shift+Enter で改行）"
          onChange={(e) => {
            setText(e.target.value);
            // 本文変更 = 新しい logical submit。古い pendingId は再利用しない
            setPendingId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button type="button" className="input-submit-btn" onClick={() => void submit()} disabled={!canSubmit}>
          送信
        </button>
      </div>
    </div>
  );
}
