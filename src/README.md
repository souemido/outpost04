# ブラウザ試作

loazgr/outpost04 の画面側ソースです。APK配布用READMEとは別です。

| パス | 内容 |
| --- | --- |
| `components/outpost/scene.tsx` | ドーム、原子炉、樽、乗員 |
| `components/outpost/cursor.tsx` | ぷにぷにカーソル |
| `components/outpost/stage.tsx` | HUDとドリフト |
| `components/leak/` | 計器コンソール、手入力シート、波形 |
| `lib/leak/` | 世界モデル、保存、外気、音 |
| `styles.css` | コンソールとカーソルの見た目 |
| `routes/index.tsx` | 入口 |

`XAI_API_KEY` などの秘密はこのツリーに入れていません。神話ログ用の鍵は実行環境の環境変数です。
