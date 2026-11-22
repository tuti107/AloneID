# ASHCOMBE HOUSE ― 闇にひとり（AloneID）

固定カメラ × ローポリゴンの古典的サバイバルホラーを、ブラウザ（Three.js）で作っているリポジトリ。UI・文章は日本語、コードとコメント・コミットメッセージは英語。
詳しい経緯・決めたこと・試して駄目だったことは **docs/handoff.md**。

## 今後ずっと守ること（ユーザーの指示）

- 起点ブランチとデフォルトブランチは、削除・改名・force push をしない。提案もしない。
- ほかのブランチを消すときは、別のセッションの起点になっていないかユーザーに確認する。
- 作業の区切りごとに push し、CLAUDE.md（要約）と docs/handoff.md（詳細）を更新する。
  - まとまった作業を終えたら返答を締める前に（コードと同じコミットでよい）。
  - 重要な指示・方針・好みが出たらその場で。長い作業は区切りごとに。
  - 会話にしか無い情報を残さない。古い記述は消す。秘密情報（鍵・トークン・個人情報）は書かない。
- 迷ったら実行せず、ユーザーに確認する。

## ブランチと公開先

- GitHub: `tuti107/AloneID`（非公開）。デフォルトブランチは `claude/ashcombe-house`。作業は全部ここ。PR は無い。
- `main` は起点ブランチ。このセッション（2026-10-24 開始、空のリポジトリから）は記録上の起点が `refs/heads/main` だったのに GitHub に無かったので、2026-11-22 にユーザーの指示で `claude/ashcombe-house` の先端から作った。
  - `main` も削除・改名・force push をしない。
  - `main` への取り込みは、ユーザーに頼まれたときだけ。やり方は `claude/ashcombe-house` と同じ位置への早送り（`git push origin HEAD:refs/heads/main`、通常の push）。2026-11-22 に一度、そこまでの作業を取り込んだ。
- push: `git push -u origin claude/ashcombe-house`
- 遊べる場所: claude.ai の Artifact https://claude.ai/artifact/Sg5D8gDgENWqL3bLqFKfqY （非公開、現在 Version 20）。
  宣言済みの capabilities は `db` と `user`（サーバー側セーブ）。再公開では `capabilities` を渡さない（引き継がれる）。
- ユーザーは iPhone の Claude アプリで、縦持ちで遊ぶ（タッチ操作・縦画面レイアウトが主）。

## 作業の決まり

- 報告は日本語で簡潔に。
- PR はユーザーに頼まれたときだけ作る。
- コミットメッセージの末尾には、そのセッションのシステム通知が指定する帰属行（Co-Authored-By / Claude-Session）を付ける。モデル ID はリポジトリ内のどこにも書かない。
- ソースのコミットの後に、リリースビルド（docs/index.html）を別コミット「Release build: …」で入れるのが慣例。
- 部屋（src/game/rooms/*.js）の build では乱数 `R()`（シード固定）の呼び出し順を変えない。順が変わると部屋の配置が全部変わる。
- 部屋は一度作ると使い回される（`getRoom` のキャッシュ）。入るたびに反映したい状態は `build` ではなく `setup`（毎回の入室で呼ばれる）に書く。

## 構成

- `build.mjs`（esbuild）
  - `node build.mjs --dev` → `dist/index.html`（テスト用。ミニファイなし）
  - `node build.mjs` → `docs/index.html`（three.js まで同梱した単一 HTML。GitHub Pages 用）と `dist/artifact.html`（Artifact 用。three.js は jsdelivr の固定版）
  - `dist/` は git 管理外、`docs/index.html` はコミットする。
- `src/main.js` 起動。開発ビルドでは `window.__game`。`?room=hall` などで部屋から開始（デバッグ）。
- `src/engine/`
  - `camera.js` 固定カメラ: 部屋ごとの Shot（zone・priority・`when` 条件）＋四隅の自動カメラ＋追従カメラ。主人公が映っているかを `evaluate`（vis/frame/size）で判定して切り替える。
  - `collision.js` 床平面の箱（Box）と円。`nav.js` 経路探索・見通し。
  - `input.js` キー・パッド・タッチ（押しっぱなしのカーソル送り）。`audio.js` WebAudio 合成。`gfx.js` 描画・ポストエフェクト・明るさ。
  - `store.js` セーブ類: localStorage と、Artifact の `db`（`data/users/<uid>`）を後勝ちで同期。
- `src/game/`
  - `game.js` 進行・扉・セーブ/ロード（扉ごとにオートセーブ）・脱出タイマー・攻撃の当たり（`damage(n, x, z, knock, how)` で刃物/打撃/銃を区別）・調べる物（`priority`）。
  - `player.js` エドガー（カメラ基準操作、スティックを倒したままならカット後も向きを保つ）。`monsters.js` 怪物（船長エゼキエルは刃物以外では膝をつくだけ）。`boss.js` 最終ボス。`follower.js` クララ。
  - `roomkit.js` 部屋の部品（box / collider / door / stairs / shot / trigger / pickup / interact / `clearOf`（積み岩を壁の外へ下げる）/ 自動カメラ / nav）。
  - `rooms/*.js` 24 部屋。`characters.js` `rig.js` `body.js` 人物と動き。`items.js` `text.js`（文書）`ui.js` `title.js` `chapters.json`（チャプター選択の開始状態）。
- `tools/walkthrough/` 通しプレイのボット（README あり）。`tools/checks/` 個別の確認（README あり）。`tools/trailer/` `tools/teaser/` 予告編づくり。
- `docs/` `EXPANSION_PLAN.md`（物語と拡張計画）、`WALKTHROUGH.md`（攻略）、`handoff.md`（引き継ぎ）。

## 確認方法

- ブラウザは Playwright + Chromium（SwiftShader）。**ブラウザを使う確認は 1 本ずつ**（並べると CPU の取り合いで偽の FAIL が出る）。
- 通し: `node build.mjs --dev && node tools/walkthrough/walkthrough.cjs`（約 30 分、147 項目、`FAILS: 0` と `no page errors` が合格）
- チャプター: `node tools/walkthrough/chapters.cjs`（部屋の仕掛けを変えたら `walkthrough.cjs --write-chapters` で記録し直す）
- 公開前: `node build.mjs && node tools/checks/smoke.cjs && node tools/checks/artifact.cjs`
- 個別: `tools/checks/escape.cjs`（最後の脱出を徒歩で）、`captain.cjs`（船長戦）、`topmap.cjs`+`overlay.py`（部屋の俯瞰図）、`views.cjs`+`sheet.py`（カメラ画像）、`lips.cjs`（壁の段差）
- Artifact の更新: リリースビルド後、Artifact ツールで `dist/artifact.html` を `url` に上の URL を付けて publish（新しい会話では先に `action: read`）。`capabilities` は渡さない。

## 現状と残課題（2026-11-22）

- ゲームは V20 公開済み（リリースビルド `a2485b9`）。通しプレイ 147/147、チャプター・smoke・artifact いずれも合格。
- 2026-11-22: 起点 `main` を GitHub に作った（セッションが開けなくなる問題の予防）。
- ユーザーの返事待ち: 一般公開の方法（A: Artifact の共有メニュー / B: GitHub Pages。B はリポジトリが非公開なので公開化か GitHub Pro が要る。Pages の設定は Branch `claude/ashcombe-house`・フォルダ `/docs`）。
- 気づいているが手を付けていない小さな点は docs/handoff.md の「残り」。
