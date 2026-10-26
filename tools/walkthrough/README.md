# 自動通しプレイ（テスト）とチャプターの記録

屋根裏から真エンディングまでを自動で遊び、各所の確認結果を `ok` / `FAIL` で表示します。SwiftShader で描くので、30 分ほどかかります。

```sh
node build.mjs --dev                                       # ゲームを dist/index.html に書き出す
node tools/walkthrough/walkthrough.cjs                     # 通しで確認する
node tools/walkthrough/walkthrough.cjs --write-chapters    # 確認して、チャプターの始まりを記録し直す
node tools/walkthrough/chapters.cjs                        # 記録した各チャプターから始められるか確かめる
```

- タイトル画面の「チャプター選択」は、`src/game/chapters.json` の状態から始めます。これは通しプレイが各チャプターの始まりに着いたときのセーブです。体力は満タン、記録時間などは 0 に戻してあります。
- 部屋の仕掛けやフラグを変えたら、`--write-chapters` で記録し直してください。古い記録のままだと、途中の扉や持ち物が食い違うことがあります。
- 記録する場所は `walkthrough.cjs` の `chapter('…')` の呼び出しです。チャプターの名前と並びは `src/game/chapters.js`。
- スクリーンショットなどは `tools/walkthrough/out/` に出ます（コミットしません）。
- 必要なもの: Playwright と Chromium。
