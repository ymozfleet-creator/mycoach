# MyCOACH ― スポーツ指導者マッチングサービス

出会った日から、伸びはじめる。
スポーツを教わりたい人（個人・チーム）とコーチをつなぐマッチングサービスです。

## 構成

- `index.html` … アプリ本体（単一ファイル。GitHub Pagesにそのまま公開できます）
  - そのまま開くとデモモード（localStorage）で全機能を体験できます
  - ファイル冒頭の `FIREBASE_CONFIG` を設定すると本番モード（Firebase Auth + Firestore）
- `setup/` … 本番セットアップ一式
  - `SETUP.md` … 手順書（Firebase / セキュリティルール / Stripe / Stripe Connect / メール通知）
  - `firestore.rules` … Firestoreセキュリティルール
  - `firebase.json` / `functions/` … Cloud Functions（Stripe決済・自動分配・メール通知）

## 公開（GitHub Pages）

Settings → Pages → Branch: main / root を選択すると
`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

## 機能

マッチング（競技×エリア×指導形態）／リアルタイムチャット／契約（提案→承諾→完了）／
Stripe決済・コーチ精算・Connect自動分配／レビュー／認証コーチ審査／通知／管理画面
