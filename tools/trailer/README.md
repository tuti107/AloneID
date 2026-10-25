# 予告編の制作ツール

ゲーム本体をそのまま撮影して、約 66 秒の予告編（1920×1080・24 fps）を作ります。映像も効果音もゲーム自身の描画と音源から作り、音楽もゲームのシンセで鳴らします。

```sh
node build.mjs --dev                    # ゲームを dist/index.html に書き出す
node tools/trailer/capture.cjs          # 各ショットを撮影 → out/shots/
node tools/trailer/score.cjs            # 音楽 → out/score.wav
python3 tools/trailer/assemble.py       # 編集・書き出し → out/trailer.mp4
```

- `capture.cjs S02 S05` のように ID を並べると、そのショットだけ撮り直します。`--preview` を付けると 6 fps・半分の大きさで素早く確認できます（out/preview/）。
- 撮影はゲームのループを止め、一定の時間刻みで 1 コマずつ進めます。乱数も固定しているので、何度撮っても同じ映像になります。WebGL は SwiftShader で描画します。
- 必要なもの: Playwright と Chromium、Python 3（Pillow・numpy）、ffmpeg。

| ファイル | 役割 |
|---|---|
| `shots.js` | 各ショットの演出（部屋、配置、カメラの動き、イベントのタイミング） |
| `runtime.js` | ページ内で撮影を進める仕組み（コマ送り、16:9 描画、効果音の録音） |
| `edit.json` | 編集台本（並び順、使う区間、長さ、音楽の打点） |
| `score.js` | 音楽。`edit.json` の時間に合わせて組み立てる |
| `cards/` | 文字カードとロゴ |

`out/` は生成物なのでコミットしません。
