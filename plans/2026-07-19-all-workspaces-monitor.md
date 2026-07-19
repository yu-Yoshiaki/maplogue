# 全ワークスペース監視

## 目的

監視セッションを `default` 専用ではなく、`data/workspaces.json` に登録されたすべてのワークスペースを含む監視へ拡張する。新しいワークスペースをアプリから作成しても、監視セッションの再起動なしで次回ポーリングから対象にする。

## 方針

- `WORKSPACE_ID` を指定した監視は、従来どおり指定した 1 ワークスペースだけを対象にする。
- `WORKSPACE_ID` を指定しない監視は、5 秒ごとに `default` と、その時点の `data/workspaces.json` の登録済み ID を再読込して巡回する。
- `default` は `data/`、登録済み ID は `data/workspaces/<workspaceId>/` に対応させる。未登録のディレクトリは対象にしない。
- 処理時の排他は各ワークスペースの `.watch.lock` で行い、他の監視がロック中のワークスペースはその巡回ではスキップする。
- 未処理入力のあるワークスペースだけを編集・検証・コミットする。編集対象は当該ワークスペースの `scene.json` と `history.json` に限定する。
- `workspaces.json`、`pins.json`、サーバー実装、型定義、既存ユーザー変更には触れない。

## Acceptance Criteria

- [x] `WORKSPACE_ID` 指定時は `default` または指定 ID の単一ワークスペースだけを監視する手順になっている。
- [x] `WORKSPACE_ID` 未指定時は `default` と `data/workspaces.json` の全登録ワークスペースを 5 秒ごとに再発見して巡回する手順になっている。
- [x] アプリから追加されたワークスペースを監視の再起動なしで次回巡回から対象にできる。
- [x] ロックはワークスペース単位であり、ロック済みの別ワークスペースは処理を妨げない。
- [x] 未処理入力を持つワークスペースだけが処理され、各処理は対象の `scene.json` / `history.json` の最小差分に限定される。
- [x] ステージングは `git add <対象workspace>/scene.json <対象workspace>/history.json` の限定指定で行う。
- [x] README の起動説明が全ワークスペース監視の既定動作と一致している。
- [x] `npm run watch:scene` で、フォアグラウンドの常駐デーモンを起動できる。デーモンは2秒ごとに全ワークスペースを再発見し、未処理入力がある場合だけ単発の Claude Code バッチを起動する。
- [x] 常駐デーモンは PID 付きの単一起動ロック、終了時のロック解放、`data/scene-watch-daemon.log` へのログ出力を行う。
- [x] `data/scene.sample.json` 以外の runtime / user data（scene・inbox・history・pins・workspaces・lock・log）を Git の公開対象から除外できる。
- [x] `claude -p --dangerously-skip-permissions` により、未処理入力がある場合だけ非対話の単発バッチをバックグラウンド起動できる。
