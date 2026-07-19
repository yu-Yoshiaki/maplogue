import { describe, expect, it } from "vitest";
import { parseOrganizeSlashCommand, resolveOrganizeSubmit } from "./parseOrganizeInput";

describe("parseOrganizeSlashCommand", () => {
  it("コマンド無しは全文を body にし overrideMode は null", () => {
    expect(parseOrganizeSlashCommand("来週までにLPを作る")).toEqual({
      overrideMode: null,
      body: "来週までにLPを作る",
      emptyBody: false,
    });
  });

  it("先頭空白は trimStart してから判定する", () => {
    expect(parseOrganizeSlashCommand("  /todo タスクを書く")).toEqual({
      overrideMode: "todo",
      body: "タスクを書く",
      emptyBody: false,
    });
  });

  it.each([
    ["/normal 本文", "normal", "本文"],
    ["/todo 本文", "todo", "本文"],
    ["/discuss 本文", "discussion", "本文"],
    ["/discussion 本文", "discussion", "本文"],
    ["/compare 本文", "compare", "本文"],
  ] as const)("%s -> mode=%s", (input, mode, body) => {
    expect(parseOrganizeSlashCommand(input)).toEqual({
      overrideMode: mode,
      body,
      emptyBody: false,
    });
  });

  it("英語コマンドは大文字小文字を区別しない", () => {
    expect(parseOrganizeSlashCommand("/TODO Hello")).toEqual({
      overrideMode: "todo",
      body: "Hello",
      emptyBody: false,
    });
    expect(parseOrganizeSlashCommand("/Discuss 論点")).toEqual({
      overrideMode: "discussion",
      body: "論点",
      emptyBody: false,
    });
  });

  it("日本語別名を mode にマップする", () => {
    expect(parseOrganizeSlashCommand("/通常 メモ")).toEqual({
      overrideMode: "normal",
      body: "メモ",
      emptyBody: false,
    });
    expect(parseOrganizeSlashCommand("/タスク やる")).toEqual({
      overrideMode: "todo",
      body: "やる",
      emptyBody: false,
    });
    expect(parseOrganizeSlashCommand("/議論 論点")).toEqual({
      overrideMode: "discussion",
      body: "論点",
      emptyBody: false,
    });
    expect(parseOrganizeSlashCommand("/比較 AとB")).toEqual({
      overrideMode: "compare",
      body: "AとB",
      emptyBody: false,
    });
  });

  it("未知の /foo は本文扱い", () => {
    expect(parseOrganizeSlashCommand("/foo 本文")).toEqual({
      overrideMode: null,
      body: "/foo 本文",
      emptyBody: false,
    });
  });

  it("コマンド直後が空白でない場合はコマンド扱いしない", () => {
    expect(parseOrganizeSlashCommand("/todo本文")).toEqual({
      overrideMode: null,
      body: "/todo本文",
      emptyBody: false,
    });
  });

  it("文中の /todo は解釈しない", () => {
    expect(parseOrganizeSlashCommand("メモ /todo は本文")).toEqual({
      overrideMode: null,
      body: "メモ /todo は本文",
      emptyBody: false,
    });
  });

  it("コマンドだけで本文が空のとき emptyBody が true", () => {
    expect(parseOrganizeSlashCommand("/todo")).toEqual({
      overrideMode: "todo",
      body: "",
      emptyBody: true,
    });
    expect(parseOrganizeSlashCommand("/todo   ")).toEqual({
      overrideMode: "todo",
      body: "",
      emptyBody: true,
    });
  });
});

describe("resolveOrganizeSubmit", () => {
  it("スラッシュ無しは選択中モードを使う", () => {
    expect(resolveOrganizeSubmit("本文", "compare")).toEqual({
      mode: "compare",
      text: "本文",
      emptyBody: false,
    });
  });

  it("スラッシュがあるとその入力だけ mode を上書きする", () => {
    expect(resolveOrganizeSubmit("/todo やる", "normal")).toEqual({
      mode: "todo",
      text: "やる",
      emptyBody: false,
    });
  });

  it("未知コマンドは選択中モードのまま全文を送る", () => {
    expect(resolveOrganizeSubmit("/foo bar", "discussion")).toEqual({
      mode: "discussion",
      text: "/foo bar",
      emptyBody: false,
    });
  });

  it("コマンドのみは emptyBody で送信不可と分かる", () => {
    expect(resolveOrganizeSubmit("/todo", "normal")).toEqual({
      mode: "todo",
      text: "",
      emptyBody: true,
    });
  });
});
