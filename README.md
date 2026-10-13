# OUTPOST #04

Android向け試作版の配布用リポジトリです。

## インストール（QRまたはリンク）

1. スマホで [最新版APK](https://github.com/loazgr/outpost04/releases/latest/download/OUTPOST04.apk) を開く（またはQRを読み取る）
2. 「提供元不明のアプリ」を許可してインストール
3. 起動後、`[SYNC DEPTH 設定]` で使いたいデータだけONにする

対応: Android 8.0+（minSdk 26）

## 注意

デバッグ署名のAPKです。Playストア用ではありません。URLを知っている人は誰でもダウンロードできます。

## ブラウザ試作のソース

`src/` は前哨基地のブラウザ版です。3Dのドームと乗員、ぷにぷにカーソル、生活データから世界がずれるリークシミュレーションが入っています。

- Androidアプリ本体（Kotlin / WebView）ではありません。APKはこれまで通り Releases にあります。
- 単体ではビルドできません。`@/` は `src/` を指す前提で、TanStack Start と three.js の上に載せる断片です。
- 入口は `src/routes/index.tsx` → `src/components/leak/console.tsx` です。
