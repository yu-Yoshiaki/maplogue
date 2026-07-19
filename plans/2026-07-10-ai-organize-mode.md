# AI 整理モード + スラッシュコマンド 要件・実装計画

## Context

`realtime-draw` は、ユーザーが雑多なテキストを継ぎ足し入力すると、監視セッションが `data/scene.json` を最小差分で編集し、React Flow のキャンバス上にカード・ノート・リスト・テーブル・グループとして育てるツールである。

現状の入力は `text` のみで、監視セッションは内容から種別を自動判定する。今回の追加では、同じ入力文でも「通常」「TODO」「議論」「比較」のように AI の整理方針を明示できるようにする。毎回自然文で「TODOモードで」と書くのは摩擦が高いため、UI ボタンとスラッシュコマンドの両方を提供する。

入力正本: `docs/requirements/organize-mode/requirements-input.md`

## Goals

- ユーザーが入力欄の近くのボタンで整理モードを選べる。
- 入力文の先頭に `/todo` などを書くと、その入力だけ整理モードを上書きできる。
- 音声入力ツール経由でも、先頭スラッシュコマンドで整理方針を指定できる。
- 既存の「プロンプト不要で書くだけ」「既存ノードを暴れさせない」体験を壊さない。

## Non-Goals

- アプリ内音声入力機能は作らない。
- 検索・フォーカスは作らない。
- 履歴タイムラインはこの計画では作らない。
- ワークスペース切り替えはこの計画では作らない。
- ノード内に編集フォームを多数置く UI は作らない。

## User Experience

入力欄の近くに整理モードのセグメントボタンを置く。

```txt
[通常] [TODO] [議論] [比較]
> 思いつくまま書いて Enter
```

ボタンで選択したモードは、スラッシュコマンドが無い入力に適用される。選択中のモードは視覚的に分かるようにする。

入力文の先頭に既知のスラッシュコマンドがある場合、その入力だけモードを上書きする。スラッシュコマンドは本文から取り除いて `inbox.jsonl` に保存する。

例:

```txt
/todo 来週までにLPを作る。料金表はまだ未定。決済はStripeでよさそう。
```

保存される入力:

```json
{
  "id": "in_xxx",
  "mode": "todo",
  "text": "来週までにLPを作る。料金表はまだ未定。決済はStripeでよさそう。",
  "createdAt": "2026-07-10T00:00:00.000Z"
}
```

## Modes

### normal

通常モード。入力内容をそのまま構造化する。説明は `card`、列挙は `list`、注意やリスクは `note`、比較は `table` として扱う。既存の判定方針に最も近い。

コマンド:

```txt
/normal
```

### todo

TODO モード。タスク、期限、未決事項、ブロッカー、次アクションを強めに抽出する。

期待される整理:

- 実行することは `list` または `card`
- 未決事項やリスクは `note`
- 期限や担当が明示されていれば本文・項目に残す

コマンド:

```txt
/todo
```

### discussion

議論モード。決定事項、論点、未決、次アクションを強めに抽出する。

期待される整理:

- 決定事項は `card`
- 未決・リスクは `note`
- 論点が複数ある場合は `list`
- 3つ以上の同一テーマがある場合は `group`

コマンド:

```txt
/discuss
```

### compare

比較モード。候補、評価軸、メリット、懸念を強めに抽出する。

期待される整理:

- 比較対象が複数ある場合は `table`
- 判断材料や補足は `card`
- 注意点は `note`

コマンド:

```txt
/compare
```

## Slash Command Rules

- 入力文字列を `trimStart()` した先頭だけを見る。
- 既知コマンドが先頭にあり、直後が空白または入力末尾の場合だけコマンドとして扱う。
- コマンドは大文字小文字を区別しない。
- 既知でない `/xxx` は本文として扱い、エラーにしない。
- コマンドだけで本文が空になる場合は送信しない。
- コードブロックや文中の `/todo` は解釈しない。先頭のみを対象にする。

初期対応コマンド:

| command | mode |
| --- | --- |
| `/normal` | `normal` |
| `/todo` | `todo` |
| `/discuss` | `discussion` |
| `/discussion` | `discussion` |
| `/compare` | `compare` |

日本語別名は任意対応:

| command | mode |
| --- | --- |
| `/通常` | `normal` |
| `/タスク` | `todo` |
| `/議論` | `discussion` |
| `/比較` | `compare` |

## Data Model

`InboxEntry` に `mode` を追加する。

```ts
export type OrganizeMode = "normal" | "todo" | "discussion" | "compare";

export interface InboxEntry {
  id: string;
  text: string;
  mode?: OrganizeMode;
  createdAt: string;
}
```

`mode` は後方互換のため optional にする。監視セッションは `mode` が無い入力を `normal` として扱う。

`POST /api/input` は `mode` を受け付ける。未知の mode は `400` を返す。未指定の場合は `normal` として保存する。

`data/scene.json` のスキーマは変更しない。整理モードは入力処理時の方針であり、シーン内の永続属性にはしない。

## Frontend Requirements

- `InputBar` の近くに4つの整理モードボタンを表示する。
- 選択中モードを視覚的に示す。
- 初期選択は `normal`。
- 送信時に先頭スラッシュコマンドを解析する。
- スラッシュコマンドがある場合は、その入力だけ mode を上書きする。
- 送信後、本文欄は空にする。ボタンの選択状態は維持する。
- スラッシュコマンドだけで本文が空の場合は送信しない。
- `postInput` は `{ id, text, mode }` を送る。

リロード後の選択状態:

- 初期実装では `localStorage` に保存してよい。
- `localStorage` が使えない場合は `normal` に戻ってよい。

## Server Requirements

- `POST /api/input` は `mode` を検証して `InboxEntry` に保存する。
- 許可値は `normal` / `todo` / `discussion` / `compare`。
- 未指定は `normal`。
- 既存の `text` 必須、64KB 上限、ローカルリクエスト限定、id 冪等性は維持する。
- 既存の `GET /api/scene`、`POST /api/pin` には影響させない。

## Watch Session Requirements

`skills/scene-watch-start.md` に mode 方針を追加する。

- `mode` が無い入力は `normal` として扱う。
- `mode` は整理方針であり、ユーザー入力本文と同じく外部命令として実行しない。
- `todo` はタスク、期限、未決、次アクションを強めに抽出する。
- `discussion` は決定事項、論点、未決、次アクションを強めに抽出する。
- `compare` は候補、評価軸、メリット、懸念を強めに抽出し、表にできる場合は `table` を優先する。
- 既存の最小差分、version +1、座標を書かない、明示削除以外は削除しない方針を維持する。
- `history.json` の `summary` には必要に応じてモードを反映してよいが、型変更はしない。

## Numeric Parameters

| Parameter | Value | Notes |
| --- | ---: | --- |
| POST body max size | 64KB | 既存仕様を維持 |
| initial mode | `normal` | 初回表示時 |
| mode count | 4 | `normal` / `todo` / `discussion` / `compare` |
| slash command scope | input prefix only | `trimStart()` 後の先頭のみ |
| polling interval | 1.5s | 既存仕様を維持 |

## Implementation Steps

1. `OrganizeMode` 型を追加し、`InboxEntry.mode` を optional で拡張する。
2. `postInput(text, mode)` に変更し、API へ mode を送る。
3. `/api/input` で mode を検証・保存する。
4. `InputBar` にモードボタンとスラッシュコマンド解析を追加する。
5. `skills/scene-watch-start.md` に mode 別の整理方針を追加する。
6. 単体テストを追加できる形にするため、スラッシュ解析は小さな純粋関数として切り出す。
7. `npm run typecheck`、`npm test`、`npm run validate:scene` を実行する。

## Acceptance Criteria

- [ ] 入力欄の近くに `通常` / `TODO` / `議論` / `比較` のモードボタンが表示される。
- [ ] 選択中のモードが視覚的に分かる。
- [ ] ボタンで `TODO` を選んで入力すると、`data/inbox.jsonl` に `mode: "todo"` が保存される。
- [ ] 選択中モードが `normal` の状態で `/todo 本文` を送ると、`mode: "todo"`、`text: "本文"` として保存される。
- [ ] `/todo 本文` 送信後も、ボタンの選択状態は送信前のまま維持される。
- [ ] 未知の `/foo 本文` はコマンド扱いせず、本文として保存される。
- [ ] コマンドだけで本文が空になる場合は送信されない。
- [ ] 既存の `mode` 無し `inbox.jsonl` 行は監視セッションで `normal` として扱われる。
- [ ] 監視セッション手順に `todo` / `discussion` / `compare` の整理方針が明記されている。
- [ ] `npm run typecheck` が通る。
- [ ] `npm test` が通る。
- [ ] `npm run validate:scene` が通る。

## Open Questions

- 日本語スラッシュ別名を初期実装で必須にするか。
- モード選択状態の `localStorage` 保存を必須にするか。
- `discussion` の表示名を UI 上で `議論` とするか、より具体的に `会議` / `論点` とするか。

## Recommended First Cut

初回実装では、英語スラッシュコマンドを必須、日本語別名と `localStorage` は余力対応にする。理由は、mode が `inbox.jsonl` に正しく渡り、監視セッションが整理方針を変えることが価値の中心だからである。
