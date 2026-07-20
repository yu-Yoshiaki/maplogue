import { describe, expect, it } from "vitest";
import { appendQuoteToText, formatItemQuote, itemDisplayLabel } from "./formatItemQuote";
import type { SceneItem } from "../types/scene";

describe("itemDisplayLabel", () => {
  it("card / group は title を使う", () => {
    expect(itemDisplayLabel({ id: "card_001", type: "card", title: "API" })).toBe("API");
    expect(itemDisplayLabel({ id: "group_001", type: "group", title: "基盤" })).toBe("基盤");
  });

  it("note は本文を短縮する", () => {
    const long = "あ".repeat(50);
    expect(itemDisplayLabel({ id: "note_001", type: "note", text: long })).toBe(`${"あ".repeat(40)}…`);
  });
});

describe("formatItemQuote", () => {
  it("id と表示名を引用行にする", () => {
    const item: SceneItem = { id: "card_002", type: "card", title: "CloudFront" };
    expect(formatItemQuote(item)).toBe("> card_002「CloudFront」");
  });
});

describe("appendQuoteToText", () => {
  it("空欄なら引用だけを入れる", () => {
    expect(appendQuoteToText("", "> card_001「A」")).toBe("> card_001「A」\n");
  });

  it("既存本文の末尾に追記する", () => {
    expect(appendQuoteToText("直して", "> card_001「A」")).toBe("直して\n> card_001「A」\n");
  });

  it("同じ引用は重複追加しない", () => {
    const text = "> card_001「A」\n";
    expect(appendQuoteToText(text, "> card_001「A」")).toBe("> card_001「A」\n");
  });
});
