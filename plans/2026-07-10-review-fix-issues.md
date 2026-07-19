# レビュー指摘修正 Issue 計画

## Context

Codex レビューと Opus 検証で、以下の4点は修正対象として妥当と判断した。

1. group 内外をまたぐノード位置・pin 座標の座標系混在
2. 入力送信の冪等性コメントと実挙動の不一致
3. `validateScene` が scene 契約の一部を検証していない
4. `validate:scene` が README の `npm install` 前提と食い違い、グローバル `bun` に依存している

特に 1 は P1。React Flow の group 子は `position` が親相対座標になるため、`parentId` 変更時に旧 position や座標系なし pin をそのまま使うと、ノードが意図しない場所へ飛ぶ。

## Goals

- group 構成変更後もノード位置が破綻しない。
- pin 座標に座標系を持たせ、トップレベル絶対座標と group 子相対座標を区別できる。
- 入力再送時に同じ submit の id を再利用し、重複登録を避ける。
- LLM 監視セッションが壊れた scene を書いた場合に、validator がより早く契約違反を検出する。
- `npm install` だけの環境でも検証手順が成立する、または Bun 前提が明示される。

## Non-Goals

- UI からの undo/redo、node 編集 UI、group 入れ子対応は扱わない。
- レイアウトアルゴリズムの全面変更はしない。
- scene / history / inbox の保存方式を DB や queue に置き換えない。
- 監視セッションの処理戦略やプロンプトを大きく変えない。

## Issue 1: pin 座標系と parentId 変更の破綻を直す

### Problem

現在は `Pins = Record<string, {x,y}>` で、座標がトップレベル絶対なのか、group 子の親相対なのか分からない。さらに `useScenePolling` は既存ノードの `position` を `parentId` 変更後も維持するため、トップレベルから group 配下へ移ったノードの絶対座標が親相対座標として再利用される。

### Proposed Fix

- `Pins` を `{ x: number; y: number; parentId: string | null }` 形式へ拡張する。
- 既存 `pins.json` との互換のため、サーバー読み取り時に旧 `{x,y}` を normalize する。
- `onNodeDragStop` で `node.parentId ?? null` を `POST /api/pin` に送る。
- `/api/pin` は `parentId` を保存する。unpin は既存どおり `x: null` を受け付ける。
- `toFlow` は pin の `parentId` と現在の `parentId` が一致する場合だけ pin を適用する。
- `useScenePolling` は旧 node と fresh node の `parentId` が一致する場合だけ旧 `position` を維持する。一致しない場合は fresh 側の layout/pin 座標を使う。
- 旧形式 pin の扱いは、初回読み取り時に `parentId: null` とみなす。group 子に旧 pin が残っている場合は current parentId と一致しないため無視される。必要ならユーザーが再ドラッグして新形式で保存する。

### Tasks

- [x] `src/types/scene.ts` の `Pins` 型を v2 形式へ更新する。
- [x] `server/sceneApiPlugin.ts` に pin normalize / validate を追加する。
- [x] `src/api/client.ts` の `postPin` に `parentId` 引数を追加する。
- [x] `src/App.tsx` の drag stop で parentId を送る。
- [x] `src/flow/toFlow.ts` で parentId 一致時のみ pin を適用する。
- [x] `src/hooks/useScenePolling.ts` で parentId 一致時のみ旧 position を維持する。
- [x] pin 座標系の unit test を追加する。

## Issue 2: 入力送信の冪等性を submit 単位にする

### Problem

`postInput()` が呼び出しごとに id を生成するため、サーバーへの append は成功したがレスポンスだけ失敗したケースで、ユーザー再送時に別 id になり重複登録される。

### Proposed Fix

- id 生成を `postInput` 内部から submit 管理側へ移す。
- `InputBar` は送信開始時に id を作り、成功するまで同じ id を保持する。
- 成功時だけ id と本文をクリアする。失敗時は本文と id を残す。
- `postInput(id, text)` は受け取った id をそのまま送る。

### Tasks

- [x] `src/api/client.ts` の `postInput` を `postInput(id, text)` に変更する。
- [x] `src/components/InputBar.tsx` に pending id を保持する state/ref を追加する。
- [x] 送信失敗後の再送が同じ id を使う unit test を追加する。
- [x] コメントを実挙動に合わせて更新する。

## Issue 3: scene validator を契約に近づける

### Problem

`src/types/scene.ts` と監視手順では id 形式、edge id、ISO8601、table row の列数などを契約として扱っているが、`validateScene` は一部を検証していない。

### Proposed Fix

優先度を分けて追加する。

- P2 相当: `updatedAt` の ISO8601 妥当性、table row の列数一致。
- P3 相当: item id prefix と type の一致、`edge_001` 形式、空 label の扱い。

id の連番単調性や欠番再利用禁止は履歴を見ないと完全検証できないため、今回の validator では扱わない。

### Tasks

- [x] `updatedAt` が空文字または ISO8601 文字列であることを検証する。初期 scene の `""` は許容する。
- [x] table の各 row が `columns.length` と一致することを検証する。
- [x] item id が `${type}_` + 3桁以上の数字であることを検証する。
- [x] edge id が `edge_` + 3桁以上の数字であることを検証する。
- [x] 対応する invalid test を追加する。
- [x] `skills/scene-watch-start.md` の検証規約とズレがあれば軽く補足する。

## Issue 4: `validate:scene` の Bun 前提を解消する

### Problem

README は `npm install` を案内しているが、`npm run validate:scene` はグローバル `bun` が必要。Node/npm のみの環境で検証が失敗する。

### Proposed Fix

推奨は npm 完結化。`tsx` を devDependency に追加し、`validate:scene` を `tsx scripts/validate-scene.ts` に変更する。追加依存を避けたい場合は README に Bun 前提を明記するが、開発者体験としては npm 完結の方が一貫する。

### Tasks

- [x] `tsx` を devDependency に追加する。
- [x] `package.json` の `validate:scene` を `tsx scripts/validate-scene.ts` に変更する。
- [x] lockfile を更新する。
- [x] README の検証コマンド説明から暗黙の Bun 前提を消す。

## Implementation Order

1. Issue 1 を先に直す。ここが実害最大で、型変更が複数ファイルへ波及する。
2. Issue 2 を直す。API client と InputBar に閉じた変更にする。
3. Issue 3 を直す。validator と tests に集中させる。
4. Issue 4 を直す。依存追加と README のみ。
5. 最後に全検証を実行する。

## Verification Plan

- [x] `npm run typecheck`
- [x] `npm test`
- [x] `npm run validate:scene`
- [x] `npm run validate:scene data/scene.sample.json`
- [x] `npm run build`
- [ ] dev server + curl で `/api/input` の duplicate、`/api/pin` の v2 保存、`/api/scene` の pins 合成を確認する。
- [ ] ブラウザで group 子をドラッグし、`pins.json` に `parentId` が保存されることを確認する。
- [ ] group 子をトップレベルへ戻す、またはトップレベル node を group 配下へ移す scene 変更で、旧 position/pin が誤適用されないことを確認する。

未実施理由: ユーザーの `data/inbox.jsonl` / `pins.json` を変更しないため、自動 unit test で代替。

## Acceptance Criteria

- [x] group 内外をまたぐ scene 変更後、ノードが旧座標系のまま飛ばない。
- [x] `pins.json` が新形式 `{x,y,parentId}` で保存される。
- [x] 旧形式 `pins.json` が存在しても `/api/scene` が落ちない。
- [x] parentId が一致しない pin は適用されない。
- [x] 入力送信失敗後の再送が同じ inbox id を使う。
- [x] `validateScene` が ISO8601 不正、table row 列数不一致、id 形式不正、edge id 形式不正を検出する。
- [x] `npm install` 後の npm script だけで scene validation が実行できる。
- [x] 既存の `npm run typecheck`、`npm test`、`npm run validate:scene`、`npm run build` が成功する。

Acceptance 補足: pin save は API 実装と normalize / toFlow tests、group 移動は mergeNodePositions tests で検証。

## Open Questions

- 旧形式 `pins.json` の group 子 pin を migration で current parentId 付きへ変換するか、互換読み取りでは `parentId: null` として無視するか。推奨は後者。誤った座標を温存するより、ユーザーが必要な node だけ再ドラッグする方が破綻が少ない。
- 空の edge label を許容するか。現状データに `label: ""` があるため、今回は許容する。

## Worker Execution

- Herdr 0.7.1 経由で Cursor Agent を 2 本並列起動（model: `grok-4.5-fast-xhigh`）。
- Worker A: Issue 1/2（pin 座標系・冪等 submit）を排他所有で実装。
- Worker B: Issue 3/4（validateScene 契約強化・`tsx` 化）を排他所有で実装。
- Codex 側で再検証: `npm ci`、`npm run typecheck`、`npm test`（29 tests）、`npm run validate:scene`（scene / sample の 2 系統）、`npm run build` が成功。
