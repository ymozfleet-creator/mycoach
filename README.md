# MyCOACH-MyTEAM — 部活動・地域クラブ運営アプリ

保護者・生徒／指導者／クラブ運営の全員が、スマホひとつで使える地域クラブ運営アプリ。運営：RELIGHT

- 公開URL：https://mycoach-c15ae.web.app/ （紹介ページ）／ `app/`（アプリ）。Firebase Hosting で公開（GitHubのmainにpushすると自動で反映）
- 本番データ：Firebase プロジェクト `mycoach-c15ae`（Auth・Firestore・Cloud Functions）／決済：Stripe

## 構成

コサポの資料は非公開リポジトリ `ymozfleet-creator/cosapo-private` に移しました。

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
  scripts/               一度だけ実行する移行スクリプト
.github/workflows/  main への push で Firebase Hosting に自動公開
```

## アプリの機能（立場ごとに画面が切り替わる）

| 立場 | できること |
|---|---|
| 保護者・生徒 | 次の予定と暑さ指数の確認、出欠をワンタップ回答、体調・練習の記録、会費のカード払い、お知らせ |
| 指導者 | クラブに所属していなくても登録可。プロフィール→本人確認（身分証の写真）→安全研修（確認テスト）→受取口座（Stripe）。クラブの募集を相性順に探して応募、依頼の引き受け、メッセージ、謝金の受け取り。所属後は担当予定・出欠・選手の負荷・AI練習メニュー |
| 運営 | 対応が必要なことの一覧、予定・会員・会費の管理、**指導者の募集と応募の採用**、指導者を探して依頼（相性スコア）、謝金のカード払い、終了後の評価、ケガ・ヒヤリハット記録、実績報告 |
| 学校・教育委員会 | 生徒の参加状況、ガイドライン（休養日・活動時間）の確認、暑さ・安全の記録の閲覧（閲覧のみ） |
| 運営事務局 | 指導者の本人確認の審査（承認・差し戻し）。承認すると身分証の画像は削除され、操作は監査ログに残る |

### 指導者マッチングの流れ
1. 指導者が登録し、本人確認と安全研修を終える（終わるまでは応募も依頼の受付もできない。Firestoreのルールでも強制）
2. クラブが募集を出す → 指導者が応募 → 運営が採用すると、指導者がクラブに加わる
   （または、運営が指導者を探して依頼 → 指導者が引き受けると、依頼ごとの専用コードでクラブに加わる）
3. 運営がアプリから謝金をカード払い（謝金＋システム利用料10%）。指導者には謝金から事務手数料20%を差し引いた額が、受取口座の設定済みならStripeから自動で振り込まれる
4. 指導が終わったら運営が評価（平均点はサーバーで集計）

- デモは立場を切り替えてもデータが残るので、「応募→審査→採用→支払い」を続けて確認できる（ログイン画面から初期化できる）

### セキュリティの方針
- 権限はすべてFirestoreのルールで強制（画面で隠すだけにしない）。返事は依頼・応募を受けた側だけ、採用はクラブの運営者だけ、審査の承認は事務局だけ
- 保護者は自分の子どもの出欠・体調だけを記録できる。保護者の追加・変更は運営だけ
- 評価・指導回数・受取口座の状態・事務局フラグ・利用停止は本人が書き換えられない（サーバーのみ）
- 支払いの記録はStripeのWebhookからのみ作成（画面から支払い済みを偽装できない）。評価は1契約につき1人1回
- メールアドレスは公開プロフィールに置かず `users_private`（本人と事務局のみ）に保存。通知メールには他の利用者が書いた文章を載せない
- 送信者のなりすまし防止（メッセージ・通知は送信者を記録し本人のみ）。ドキュメントIDと画面内リンクは英数字のみ
- Cloud Functions：本人確認（失効済みトークンも拒否）、利用停止アカウントの拒否、1分20回の回数制限、呼び出し元サイトの限定、内部エラーの非表示
- 決済・口座設定の戻り先URLは許可したドメインのみ。カード情報・口座情報はStripeが管理し、このシステムには保存しない
- 画面：Content-Security-Policy、他サイトへの埋め込み防止、招待コードは暗号学的乱数で8文字。旧アプリのXSS（属性への値の埋め込み）を修正

- 謝金はいったん事務局が預かり、クラブの運営の確認（または支払いから7日後に自動）で指導者へ送金（`releasePayout` / `autoReleasePayouts`、二重送金防止の排他処理と冪等キー付き）
- 日本版DBS：犯罪事実確認は「確認した日・次回期限」だけを記録でき、結果は保存できない（ルールで項目を限定）。相談窓口は匿名の場合送り主を記録しない
- 通報：事務局が確認して写真を非表示・募集を締め切り（事務局ができる変更はルールで写真と募集の状態だけに限定）
- 利用規約・プライバシーポリシー・特定商取引法に基づく表記：`legal.html`（登録時に同意を取得し `agreedAt` に記録）

### 運用側で行うセキュリティ設定（コードでは設定できないもの）
1. ルールと関数を反映：`firebase deploy --only firestore:rules,firestore:indexes,functions`
2. 旧データのメールアドレス移行（1回だけ）：`cd setup/functions && node ../scripts/migrate-emails.js mycoach-c15ae`
3. Firebase Authentication：メール列挙保護をON、パスワードポリシー（12文字以上・英数字混在）、事務局アカウントは多要素認証（SMS）を必須に
4. App Check：reCAPTCHA Enterprise のサイトキーを作成し `web/src/lib/config.ts` の `APP_CHECK_SITE_KEY` に設定 → 動作確認後、Firestore・Functions で「適用」をON
5. Google Cloud の APIキー制限：Firebaseの公開キーに「HTTPリファラー（公開ドメインのみ）」と「使用するAPIのみ」の制限をかける
6. 予算アラート：Google Cloud の請求に予算と通知を設定（大量アクセスによる高額請求の早期発見）
7. Stripe：管理画面の2段階認証、Radar（不正決済検知）をON

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

- Firebase Authentication で「メール/パスワード」と「Google」を有効化し、承認済みドメインに `mycoach-c15ae.web.app`（初期設定で登録済み）と独自ドメインを登録
- Stripe の Webhook（`stripeWebhook`）は既存のものをそのまま使う（会費の支払いも自動で反映）
- 運営事務局の担当者は、Firebaseコンソールで `users/{担当者のuid}` に `isAdmin: true` を設定（画面からは設定できない）
- Stripe の Connect（Express）を有効にし、Webhook で `checkout.session.completed` と `account.updated` を購読する（シークレット `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` `STRIPE_WEBHOOK_SECRET_CONNECT`）
- 上記が済むまでは、ログインはできてもクラブ作成・参加がルールで拒否される。その間は「デモで試す」で確認できる
