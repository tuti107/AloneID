# 確認用スクリプト

ゲームを Playwright + Chromium（SwiftShader）で動かして確かめるスクリプトです。出力（画像・JSON）は `tools/checks/out/` に出ます（コミットしません）。同時に複数走らせると CPU の取り合いで時間待ちが外れ、偽の FAIL が出ます。1 本ずつ走らせてください（とくに `tools/walkthrough/walkthrough.cjs` の最中は何も並べない）。

## 公開前（リリースビルド）

```sh
node build.mjs                      # docs/index.html と dist/artifact.html
node tools/checks/smoke.cjs         # docs/index.html: タイトル → 第二幕の広間、地図、後半の各部屋がエラーなく組み上がるか
node tools/checks/artifact.cjs      # dist/artifact.html を claude.ai の Artifact と同じ形で開き、タイトルまで出るか（three.js の CDN は node_modules で代用）
```

## 開発中（dist/index.html、`node build.mjs --dev` で作る）

| スクリプト | 何を確かめるか |
|---|---|
| `escape.cjs` | ラスボス後の脱出を、プレイヤーと同じくカメラ基準のスティック操作で走り切る（祭殿 → 潮の洞窟 → 納骨堂 → 墓地）。止まった所と残り時間を出す |
| `captain.cjs` | エゼキエル船長：銃では膝をつくだけで立ち上がる。膝をついた船長に「斬る」でカトラスに持ち替えてとどめ |
| `topmap.cjs` + `overlay.py` | 部屋の真上からの図に、当たり判定（赤）・トリガー（黄）・入口（緑）・調べる物（水色）と、各地点を受け持つカメラ、映せていない地点（白い×）、景色の中に立ててしまう地点（マゼンタ）を重ねる |
| `views.cjs` + `sheet.py` | 指定した地点に主人公を立たせたときのカメラ画像を並べる |
| `lips.cjs` | 全部屋の当たり判定で、壁沿いに数 cm だけ出っ張って体が引っかかる段差を探す |

```sh
node tools/checks/topmap.cjs shrine fromCave shrine '{"godBurned":true,"finalEscape":true}'
python3 tools/checks/overlay.py shrine            # -> tools/checks/out/map_shrine.png
node tools/checks/views.cjs tidecave fromShrine t '{}' "7.8,-4.0,1.57;5.0,-6.0,0"
python3 tools/checks/sheet.py t                   # -> tools/checks/out/sheet_t.png
```

`topmap.cjs` と `views.cjs` は、`src/game/chapters.json` の「abyss」チャプター（終盤）のフラグに、引数の JSON を足した状態で部屋を作ります。
