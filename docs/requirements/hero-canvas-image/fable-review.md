# ヒーローキャンバス要件定義 レビュー結果

- レビュー日: 2026-07-10
- レビュアー: 独立要件レビュー担当（Claude Fable 5）
- 対象:
  - `docs/requirements/hero-canvas-image/requirements-input.md`
  - `docs/requirements/hero-canvas-image/requirements.md`
  - `docs/requirements/hero-canvas-image/requirements-map.json`
  - 参照画像: `docs/requirements/hero-canvas-image/assets/option-2.png`
- 突き合わせた既存実装: `src/types/scene.ts`, `src/flow/toFlow.ts`, `src/App.tsx`

## 最終判定: **Needs revision**

P0 が2件（切り替え機構の未定義、再現対象インベントリの不足）あり、いずれも「どの画面に・何を作るか」という実装の入口を止めるため、Q-001 の確定と要素インベントリの追加を経てから次フェーズに進むべき。P1 の schema 矛盾（HeroSceneDefinition / styleIntent）は文書修正のみで解消でき、方向性自体（既存 React Flow 構造の活用）は妥当。

## Findings

### P0-1: SCR-001/SCR-002 が同一 route "/" で、切り替え機構が未定義（Q-001 が実装をブロックする）

- **根拠**: requirements-map.json:94 と requirements-map.json:119 の両画面が `"route": "/"`。requirements.md:19 は「専用 class または専用表示状態で切り替えられる設計」とするが、何をトリガーに切り替わるかの定義がどこにもない。既存実装はルーターなしの単一画面 SPA で、表示内容は workspace 選択のみで決まる（src/App.tsx:156-170）。
- **影響**: 改修箇所1〜4すべての設計前提（テーマ適用条件、fitView 調整の発動条件、オーバーレイ表示条件）が決まらず、Q-001 が open のままでは実装に着手できない。SCR-001 の acceptance も検証対象画面を特定できない。
- **最小の修正案**: Q-001 を「blocking（実装前に必須回答）」と明記した上で、要件側に仮決定を1つ置く。例:「ヒーロー用ワークスペース（例: id `hero`）を追加し、`activeWorkspaceId === "hero"` のとき `hero-canvas` class を適用する」。これなら既存の workspace 機構（src/App.tsx:157-159, data/workspaces.json）にそのまま乗る。

### P0-2: 参照画像の要素インベントリが不完全で、「主要要素の再現」の判定基準が定まらない

- **根拠**: 参照画像（assets/option-2.png）には、キャンバス上のカード群のほかに ①左側の大キャッチコピー「書けば、図になる」「書くたびに、考えがひろがる。」と「はじめる」CTA、②上部ナビ、③キャンバス左端の縦型ツールパレット、④ピンク/オレンジの付箋、⑤破れた紙の輪郭が写っている。要件が再現対象として列挙するのは「企画メモ・利用者の声・次の一手・優先度・資料カード群」（requirements.md:24, requirements-map.json:111）のみ。ナビ・ログインは除外明記あり（requirements-input.md:42）だが、キャッチコピーとツールパレットは再現対象にも除外事項にも現れない。一方 requirements.md:36 は「左のメッセージや下部入力欄と干渉しない」と、定義されていない「左のメッセージ」の存在を前提にしている。
- **影響**: 受入れ基準1「主要要素が再現されている」（requirements.md:84）と T-005（requirements-map.json:584-596）が、何を再現すれば合格かを判定できない。実装者がキャッチコピーやツールパレットまで作り込むか、逆に付箋の色まで省くか、解釈が発散する。
- **最小の修正案**: requirements.md に参照画像の要素インベントリ表（要素 / 再現する・しない・未決 / 対応ノード種別）を1節追加する。最低限、キャッチコピー・ツールパレット・付箋2色・破れ紙輪郭の4点の扱いを確定させる。

### P1-1: ENT-001 HeroSceneDefinition が既存 Scene schema と矛盾している

- **根拠**: ENT-001 は `id/title/items/edges/sourceImage` を定義（requirements-map.json:160-213）し、state_policy で「既存 scene schema と互換にする」とするが、既存 `Scene` は `version/title/updatedAt/items/edges` で（src/types/scene.ts:55-64）、`id` も `sourceImage` も持たず、逆に必須の `version`/`updatedAt` が ENT-001 にない。
- **影響**: T-007「ヒーロー用 scene fixture を toFlow に通す」（requirements-map.json:612-622）は、ENT-001 定義通りの fixture では型不一致で成立しない。互換と非互換の中間の schema が生まれ、実装時に迷いが出る。
- **最小の修正案**: ENT-001 を「既存 `Scene` 型そのもの + 専用ワークスペースとして配置」と再定義し、`sourceImage` は scene 内フィールドではなく要件ドキュメント側の参照情報（VIS-001 に既にある）へ移す。

### P1-2: ENT-003 の `styleIntent` フィールドが自身の state_policy および除外事項と矛盾

- **根拠**: ENT-003 は `styleIntent` を SceneEdge のフィールドとして定義（requirements-map.json:292-297）する一方、同エンティティの state_policy は「表示時の style は変換層で付与」（requirements-map.json:313）。既存 `SceneEdge` は `id/source/target/label` のみ（src/types/scene.ts:47-53）で、scene.json は AI 監視セッションも書き込む共有 schema（src/types/scene.ts:1）。schema 拡張は「バックエンドの AI 整理ロジック変更」を除外する requirements-input.md:41 と衝突する。
- **影響**: 実装者が scene schema を拡張するか変換層で完結させるか判断できず、誤って schema を触ると監視セッション互換を壊す（NG-002 相当の回帰リスク）。
- **最小の修正案**: `styleIntent` を ENT-003 のフィールド定義から削除し、「ヒーロー用 edge スタイルは toFlow または theme class で一律適用、scene schema は変更しない」と明記する。

### P1-3: Q-002 のリスク記述に「監視セッションによるヒーローシーン上書き」が漏れている

- **根拠**: Q-002（requirements-map.json:741-746）は保存・ピン・履歴への影響のみ挙げるが、既存アーキテクチャでは workspace ごとに監視セッション（AI）が scene.json を書き換える。ヒーローシーンを通常 workspace として置くと、誰かが入力欄から送信した瞬間に AI が精緻に作ったデモシーンを再整理・破壊し得る。UX-001 の friction「デモとユーザー実データの区別が曖昧」（requirements-map.json:452）に近い記述はあるが、データ保全としては未定義。
- **影響**: Q-002 の回答判断に必要な材料が不足し、「編集可」を選んだ場合の回帰・デモ破壊リスクが見えない。
- **最小の修正案**: Q-002 の impact に「入力送信・AI 整理によるヒーローシーン改変の許容可否」を追記し、NG 条件に「デモシーンが意図せず破壊されたまま初見ユーザーに表示される」を追加検討する。

### P1-4: 視覚検証の方法が手動/自動どちらとも決まっておらず、テスト可能性が弱い

- **根拠**: 追加箇所4「視覚回帰確認」（requirements.md:77-80）は「スクリーンショット確認を追加する」とだけあり、T-001/T-004/T-005/T-006 はすべて `level: manual` の目視。UX-001 の acceptance「5秒以内に理解できる」（requirements-map.json:468）は測定手段が定義されていない。OK-001〜OK-003 の evidence も「スクリーンショット」のみで、比較基準・撮影条件（viewport 幅は T-004 の 390px 以外未指定）がない。
- **影響**: 受入れ判定がレビュアーの主観に依存し、OK/NG の再現性がない。「視覚回帰」と呼びつつ回帰検知（基準画像との差分）の仕組みが定義されていない。
- **最小の修正案**: ①「5秒以内」を削除するか「レビュアー1名による主観確認」と正直に格下げする、②スクリーンショットの標準条件（デスクトップ 1280px / モバイル 390px、対象状態）を明記する、③自動視覚回帰（Playwright 等）は今回スコープ外なら除外事項に明示する。

### P2-1: 修正箇所3のオーバーレイ列挙に MiniMap / Controls が漏れている

- **根拠**: requirements.md:52 は WorkspaceBar, scene-title, HistoryPanel, StatusBadge, InputBar を列挙し、53行目で「ミニマップ」に触れるが対象リストに `MiniMap` と `Controls`（src/App.tsx:273-274）が含まれていない。empty-hint オーバーレイ（src/App.tsx:293-299）も未言及。
- **影響**: 実装時に MiniMap/Controls/empty-hint の扱い（ヒーロー表示で非表示にするか）が漏れる可能性。
- **最小の修正案**: 修正箇所3の対象に `MiniMap`, `Controls`, `empty-hint` を追記する。

### P2-2: NoteItem の `tone` 語彙が参照画像の付箋2色を表現できるか未確認

- **根拠**: 既存 `NoteItem.tone` は `"warning" | "info"` のみ（src/types/scene.ts:23）。参照画像にはピンク（利用者の声）とオレンジの付箋が別色で存在する。要件は「ノートは付箋」（requirements.md:25）と書くのみで、色の対応と tone 拡張要否に触れていない。
- **影響**: 軽微だが、tone を増やすなら scene schema 変更（P1-2 と同じ互換問題）に波及するため、事前に判断しておくべき。
- **最小の修正案**: 「付箋色は既存 tone 2種にマップし、schema は拡張しない」または「tone 追加は別判断」と1行明記する。

### P2-3: 参照画像パスが二重管理になっている

- **根拠**: requirements-input.md:5 は `data/option-2.png` を対象と記載、requirements-map.json:19,824 は `docs/requirements/hero-canvas-image/assets/option-2.png` を参照。両方が実在し、data/ 側はユーザーデータ置き場（scene.json, pins.json 等と同居）。
- **影響**: どちらが正か曖昧。data/ 側は今後のワークスペース運用で誤削除されうる。
- **最小の修正案**: assets/ 側を正本と明記し、data/option-2.png は将来削除可と注記する。

## 要確認事項

1. **Q-001（配置先）** — 最優先。専用ワークスペース案なら既存機構に乗り実装が最小になるため、推奨案として提示して確認するとよい。
2. 参照画像内の**キャッチコピー・ツールパレット・破れ紙輪郭**を再現対象に含めるか（P0-2）。
3. ヒーローシーンへの**入力送信・AI 整理を許可するか**（Q-002 拡張、P1-3）。
4. 視覚検証を**手動チェックリストで確定するか、自動視覚回帰まで入れるか**（P1-4）。

## 良い点

1. **アンチゴールの徹底**: 「画像を背景に貼るだけ」を rejected_options（REJ-001）・NG-001・negative test T-009 の3層で禁止しており、要件の核が崩れにくい。
2. **既存互換の要件化**: UC-002 / OK-004 / ENT-005 / T-002・T-003・T-007 で通常キャンバスの回帰防止を最初から一級要件にしている。T-007 が実在の `toFlow(scene, pins)` シグネチャと一致している点も良い。
3. **参照画像の位置づけが明確**: `is_normative: false`（VIS-001）と「ピクセル完全再現は対象外」の宣言で、忠実度をめぐる手戻りを予防している。

## 最終判定（再掲): **Needs revision**

P0 2件（切り替え機構・要素インベントリ）の解消後に次フェーズへ進むこと。
