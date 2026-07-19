# マップ反映状況の可視化

## 目的

入力送信から AI による scene 反映まで時間がかかる間も、現在どの段階にあり、監視デーモンが動いているかを選択中ワークスペース単位で把握できるようにする。

## 実装方針

- `scripts/scene-watch-daemon.sh` が runtime status JSON を `data/` 配下に tmp → rename で書き、heartbeat と直近バッチの開始・成功・失敗時刻、処理対象ワークスペースを記録する。
- `/api/scene` は選択中ワークスペースに対応する worker status を返す。runtime status が無い状態は通常の未起動状態として扱い、壊れた status を正常に見せるフォールバックは追加しない。
- クライアント側では API の worker status、pending 件数、送信直後のローカル状態を組み合わせ、表示状態を純粋関数で判定する。
- 既存の 1.5 秒ポーリング、scene/pins の差分反映、pending 推定、ノード位置保持、複数ワークスペース巡回は維持する。
- UI は経過時間を定期更新し、反映成功は短時間表示した後に消してよい。
- 新規依存は追加せず、変更は既存の責務周辺へ局所化する。

## 想定する状態

- 受付済み: 送信成功直後、または未処理入力があり worker がまだ対象バッチを開始していない。
- AI整理中: 選択中ワークスペースを対象にしたバッチが進行中。
- 再試行/失敗: 直近バッチが失敗して未処理入力が残っている。
- 監視停止: 未処理入力があるのに heartbeat が所定時間より古い、または監視が未起動。
- 反映済み: 未処理入力が 0 になり、直近成功を短時間だけ表示する。
- scene stale / API error: 既存表示を維持する。

## 対象

- `scripts/scene-watch-daemon.sh`
- `server/sceneApiPlugin.ts`
- `src/types/scene.ts`
- `src/hooks/useScenePolling.ts`
- `src/components/StatusBadge.tsx`
- 必要最小限のスタイル、隣接 unit test、`README.md`

## 対象外

- AI 処理方式そのものの常駐化/API 化
- scene schema やレイアウトアルゴリズムの変更
- 依存パッケージ追加
- commit / push
- `data/scene.sample.json`、`marketing-video/`、既存 plan の変更

## Acceptance Criteria

- [x] 入力送信直後から「受付済み」を表示できる。
- [x] 選択中ワークスペースについて「AI整理中」「再試行/失敗」「反映済み」を区別して表示できる。
- [x] 既存の API 接続エラーと `scene.json` stale 表示が維持される。
- [x] 監視デーモンが heartbeat、バッチ開始・成功・失敗時刻、対象ワークスペースを runtime status JSON に atomic に記録する。
- [x] runtime status JSON は Git 管理対象にならない。
- [x] `/api/scene` が選択中ワークスペースの worker status を型付きで返す。
- [x] pending がある状態で heartbeat が一定時間古い、または監視未起動なら「監視が停止しています」と判定できる。
- [x] 状態表示の経過時間が秒または短い自然表記で定期更新される。
- [x] 成功表示は短時間だけ表示され、その後消える。
- [x] 1.5 秒の scene polling、pending 推定、ノード位置保持、複数ワークスペース処理が維持される。
- [x] 状態判定と表示ロジックに unit test が追加される。
- [x] README に監視状態表示と runtime status の説明が追記される。
- [x] 新規依存、フォールバック経路、過剰な抽象化を追加しない。
- [x] `npm test` が成功する。
- [x] `npm run typecheck` が成功する。
- [x] `npm run build` が成功する。
- [x] `data/scene.sample.json`、`marketing-video/`、既存 plan に変更を加えない。
- [x] Herdr 上の新規 Cursor Agent（`cursor agent --auto-review`）へ実装と一次検証を委譲する。

## 検証

```bash
npm test
npm run typecheck
npm run build
git diff --stat
git status --short
```
