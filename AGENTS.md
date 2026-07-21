# AGENTS.md

## Cursor Cloud specific instructions

Maplogue は「雑多なテキストを AI がキャンバス上の構造図に整理する」ローカル専用ツール。単一の Node.js/TypeScript (Vite + React 19 + React Flow) プロジェクトで、DB や独立バックエンドは無く、API は Vite dev サーバー内のカスタムプラグイン (`server/sceneApiPlugin.ts`) が担う。状態は `data/` 配下の JSON/JSONL ファイル。`marketing-video/` は Remotion 製のデモ動画生成用サブプロジェクト（独立 npm、実行時 `ffmpeg` 使用、アプリ本体には不要）。

標準コマンドは `package.json` の scripts と `README.md` を参照（`dev` / `typecheck` / `test` / `build` / `validate:scene` / `dev:mobile` / `watch:scene`）。以下は非自明な注意点のみ。

- アプリ本体の動作確認は `npm run dev`（`http://127.0.0.1:5173`、`127.0.0.1` 固定）だけで完結する。入力送信・シーン描画・ピン保存は Vite プロセス内 API で動く。`claude` CLI は不要。
- サンプル図を描画したいときは `cp data/scene.sample.json data/scene.json` してから `npm run dev`。新規 clone では初回リクエスト時に空の `default` ワークスペースが自動生成される。
- `data/` 配下（`scene.json` / `inbox.jsonl` / `pins.json` / `history.json` / `workspaces*` / lock / log / `scene-watch-status.json`）は runtime data で Git 管理外。`data/scene.sample.json` のみ追跡対象。
- 監視デーモン `npm run watch:scene`（`scripts/scene-watch-daemon.sh`）は AI 整理のためのもので、**ログイン済みの `claude` CLI (Claude Code) が PATH 上に必要**。この環境には未導入かつ Anthropic 認証が要るため、AI による自動整理を伴うエンドツーエンド検証には別途 `claude` のインストールとログインが必要。CLI が無い場合、入力は `data/inbox.jsonl` に溜まるが `scene.json` は更新されない。
- `npm run build` は `vite build`（静的成果物）のみ。`/api/*` は dev プラグイン (`apply: "serve"`) 限定なので、本番ビルドの静的出力には API は含まれない。動作確認は必ず dev サーバーで行う。
- `REALTIME_DRAW_ALLOW_REMOTE_WRITE=1`（`dev:mobile` が付与）を付けると private/Tailscale IP からの書き込みを許可。既定の `npm run dev` はローカル書き込みのみ。
