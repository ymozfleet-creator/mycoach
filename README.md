# MyCOACH-MyTEAM — 部活動・地域クラブ運営アプリ

保護者・生徒／指導者／クラブ運営の全員が、スマホひとつで使える地域クラブ運営アプリ。運営：RELIGHT

- 公開URL：https://ymozfleet-creator.github.io/mycoach/ （紹介ページ）／ `app/`（アプリ）
- 本番データ：Firebase プロジェクト `mycoach-c15ae`（Auth・Firestore・Cloud Functions）／決済：Stripe

## 構成

```
index.html          サービス紹介ページ
app/                アプリ本体（web/ のビルド成果物。直接編集しない）
web/                アプリのソース（React + TypeScript + Tailwind CSS + Vite、PWA）
mycoach-app.html    旧MyCOACH（個人レッスンのマッチング）
app.html            旧デモ画面 → app/ への転送
setup/              Firebase設定（firebase.json が参照する本番用）
  firestore.rules        セキュリティルール
  firestore.indexes.json 複合インデックス
  functions/             Cloud Functions（Stripe決済・AI・通知）
cosapo/             コサポ一式（退避・温存）
```

## アプリの機能（立場ごとに画面が切り替わる）

| 立場 | できること |
|---|---|
| 保護者・生徒 | 次の予定と暑さ指数の確認、出欠をワンタップ回答、体調・練習の記録、会費のカード払い、お知らせ |
| 指導者 | 担当予定と出欠数、当日の出席確認、練習負荷が急増した選手の把握、AIによる練習メニュー作成、クラブからの依頼の受諾・メッセージ |
| 運営 | 対応が必要なことの一覧、予定の登録（毎週くり返し）・変更・中止連絡、会員と減免の管理、会費の一括請求・未納のお知らせ、指導者探し（相性スコア）と依頼、ケガ・ヒヤリハット記録、自治体向け実績報告（CSV・印刷） |

- 登録せずに「デモで試す」から、3つの立場の画面を体験できる（データはブラウザ内のみ）
- 招待コードは2種類：保護者・生徒用と指導者用。指導者用で参加した人だけが会員全員の情報を見られる

## 開発

```
cd web
npm install
npm run dev          # 開発サーバー
npx vite build       # ../app に出力（コミットして公開）
```

## 本番での初回設定（運営側で1回だけ）

```
firebase deploy --only firestore:rules,firestore:indexes   # 新しいルールとインデックス
firebase functions:secrets:set ANTHROPIC_API_KEY            # AI練習メニュー（Claude API）
firebase deploy --only functions                            # createFeeCheckout / aiAssist / Webhook更新
```

- Firebase Authentication で「メール/パスワード」と「Google」を有効化し、承認済みドメインに `ymozfleet-creator.github.io` を追加
- Stripe の Webhook（`stripeWebhook`）は既存のものをそのまま使う（会費の支払いも自動で反映）
- 上記が済むまでは、ログインはできてもクラブ作成・参加がルールで拒否される。その間は「デモで試す」で確認できる
