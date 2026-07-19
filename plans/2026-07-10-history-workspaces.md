# 履歴タイムラインとワークスペース切り替え

## 目的

既存の単一 `data/` 構成を壊さず、画面から処理履歴を確認できるようにし、複数の作業領域を追加・切り替えできるようにする。

## 方針

- 既存の `data/scene.json` / `data/inbox.jsonl` / `data/history.json` / `data/pins.json` は `default` ワークスペースとして扱う。
- 新規ワークスペースは `data/workspaces/<workspaceId>/` 配下に同じ4ファイルを持つ。
- API は `workspaceId` を受け取り、未指定時は `default` にフォールバックする。
- 履歴 UI は現在選択中のワークスペースの `history.json` を一覧表示する。
- 入力送信・ピン保存・シーン取得は選択中ワークスペースに対して行う。
- 監視セッション手順に `WORKSPACE_ID` の扱いを追記する。

## Acceptance Criteria

- [x] 既存データが `default` ワークスペースとしてそのまま表示される。
- [x] 画面上でワークスペース一覧を見られる。
- [x] 画面上で新規ワークスペースを作成できる。
- [x] ワークスペース切り替え後、シーン取得・入力送信・ピン保存が選択中ワークスペースを使う。
- [x] 履歴パネルで現在ワークスペースの処理履歴を確認できる。
- [x] `workspaceId` の不正値は API で拒否される。
- [x] `npm run typecheck` / `npm test` / `npm run validate:scene` / `npm run build` が通る。
