import type { SceneItem } from "../types/scene";

/** 引用に載せる短い表示名（タイトル優先、なければ本文先頭） */
export function itemDisplayLabel(item: SceneItem): string {
  switch (item.type) {
    case "card":
    case "group":
      return item.title.trim() || item.id;
    case "list":
    case "table":
      return (item.title?.trim() || item.id);
    case "note": {
      const text = item.text.trim();
      if (!text) return item.id;
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
  }
}

/**
 * ノードクリック時に入力欄へ差し込む引用行。
 * 監視セッションは `> itemId「…」` を部分修正の対象指定として扱う。
 */
export function formatItemQuote(item: SceneItem): string {
  return `> ${item.id}「${itemDisplayLabel(item)}」`;
}

/** 既存本文の末尾に引用を追記する。重複行は足さない。 */
export function appendQuoteToText(text: string, quote: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) return `${quote}\n`;
  const lines = trimmed.split("\n");
  if (lines.some((line) => line.trim() === quote)) return `${trimmed}\n`;
  return `${trimmed}\n${quote}\n`;
}
