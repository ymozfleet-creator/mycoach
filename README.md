# MyCOACH 本番セットアップ手順

mycoach.html はそのまま開けばデモモードで動きます。

**STEP 1〜3（約30分）だけで、決済オンライン化を除く全機能が本番稼働します。**
マッチング・チャット・契約・支払い記録（手動）・レビュー・認証審査・通知・
管理画面まで、サーバー不要・Firebase無料枠の範囲で動作します。
STEP 4（Stripe決済）と STEP 5（メール通知）は任意の拡張で、後日で構いません。

本番モードのコードは、Firestore互換テストで全機能（登録／マッチ／チャット／
契約／通知／レビュー／認証審査／通報／退会）の動作検証済みです。

---

## STEP 1. Firebase プロジェクト（必須・無料枠でOK）

1. https://console.firebase.google.com で新規プロジェクト作成
2. **Authentication** → ログイン方法 →「メール / パスワード」を有効化
3. **Firestore Database** → データベース作成（ロケーション: asia-northeast1）
4. プロジェクト設定 → マイアプリ → Webアプリ追加 → 表示される `firebaseConfig` をコピー
5. `mycoach.html` をエディタで開き、冒頭の `FIREBASE_CONFIG = null;` を
   コピーした設定に書き換える：

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // 以下そのまま貼り付け
};
```

これだけで localStorage → Firebase Auth + Firestore に切り替わります。
コレクション（users / likes / matches / contracts / reports /
notifications / payments / reviews）は利用に応じて自動生成されます。

## STEP 2. セキュリティルール（必須）

Firestore → ルール タブに、同梱の **firestore.rules** の内容を貼り付けて公開。
（CLIなら `firebase deploy --only firestore:rules`）

- Stripe連携（STEP 4）まで完了したら、`payments` の `allow create` を
  `if false;` に変更するとより安全です（書き込みがWebhook＝Functions経由のみになるため）。
  手動記録（銀行振込など）を併用する場合は現状のままにしてください。

## STEP 3. 公開と管理者設定（必須）

1. `mycoach.html` を GitHub Pages / Firebase Hosting にドラッグ&ドロップで公開
2. 公開ページから管理者用アカウントを通常登録（受講者としてでOK）
3. Firestore → users → 該当ドキュメントに手動でフィールド追加：
   `isAdmin` : `true` （boolean）
4. 再ログインすると管理画面が表示されます

→ **ここまでで本番公開できます。** 決済は「支払いを記録する（銀行振込など）」の
手動記録モードで動作します。

## STEP 4. Stripe 決済（オンライン課金を有効化）

契約金額に連動したカード決済を有効にします。
お金の流れは「受講者 → Stripe → 運営（プラットフォーム）→（精算）→ コーチ」です。
手数料は両建てモデル：受講者はレッスン料+システム利用料5%を支払い、
コーチはレッスン料から事務手数料15%を控除した額を受け取ります
（例：レッスン料¥5,000 → 受講者支払 ¥5,250 / コーチ受取 ¥4,250 / 運営収益 ¥1,000）。
受講者の決済は自動記録され、コーチへの支払いは管理画面の「コーチ精算」で
未払い額を確認 → 銀行振込 → 精算済みボタン、で管理します。

### 4-1. デプロイ

```bash
npm i -g firebase-tools
firebase login
cd このセットアップフォルダ        # firebase.json がある場所
firebase use --add               # 対象のFirebaseプロジェクトを選択
cd functions && npm install && cd ..
firebase functions:secrets:set STRIPE_SECRET_KEY      # sk_test_... または sk_live_...
firebase deploy --only functions:createCheckoutSession
```

デプロイ完了時に表示される createCheckoutSession のURL
（https://asia-northeast1-～.cloudfunctions.net/createCheckoutSession）を
mycoach.html の `STRIPE_CHECKOUT_ENDPOINT` に貼って再アップロードします。

### 4-2. Webhook（決済完了の自動記録）

```bash
firebase deploy --only functions:stripeWebhook
```

Stripeダッシュボード → 開発者 → Webhook → エンドポイント追加：
- URL: stripeWebhook のURL
- イベント: `checkout.session.completed`

表示された署名シークレット（whsec_...）を登録して再デプロイ：

```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase deploy --only functions:stripeWebhook
```

※ Webhookは同一イベントの二重配信があっても二重記録されないよう
冪等化済みです（stripe_events コレクションで管理）。

### 4-3. テスト

Stripeのテストモード（sk_test）で、カード番号 4242 4242 4242 4242 /
任意の未来の有効期限 / 任意のCVC で一連の流れを確認できます：
受講者「Stripeで安全に支払う」→ 決済 → アプリに戻る →
契約カードに支払い記録 → コーチに通知 → 管理画面の決済管理・コーチ精算に反映。
問題なければ本番キー（sk_live）に差し替えて同じ手順を繰り返します。

### 4-4. 運用（コーチへの精算）

管理画面 → 決済管理 → コーチ精算 に、コーチ別の未払い受取額
（レッスン料から事務手数料15%を控除した額）が集計されます。
月末などに銀行振込を実施したら「精算済みにする」を押すと、
精算履歴に記録され、コーチへ自動通知されます。精算CSVも出力できます。

### 4-5. Stripe Connect（自動分配・任意）

振込作業を自動化したい場合は、Stripe Connect（Express）を有効化します。
コーチが自分でStripeの本人確認＋口座登録を行い、以後の決済は
「受講者 → Stripe →（受講者5%＋コーチ15%を運営へ / 残額をコーチへ）」と自動分配されます。
口座未設定のコーチは従来どおり事務局振込（コーチ精算）になる併用設計です。

1. Stripeダッシュボード → Connect → 有効化（Expressを選択。プラットフォーム
   情報の登録と審査があります。通常数日）
2. デプロイ：

```bash
firebase deploy --only functions:createConnectLink
```

3. 表示されたURLを mycoach.html の `STRIPE_CONNECT_ENDPOINT` に貼って再アップロード
4. Stripeダッシュボード → Webhook →「**Connectアプリケーションからのイベント**」で
   エンドポイントを追加（URLは stripeWebhook と同じ）
   - イベント: `account.updated`
   （コーチの口座審査が完了すると自動でアプリに反映され、コーチに通知されます）
5. コーチはマイページの「受取口座を設定する（Stripeへ移動）」から登録

自動分配された決済は、管理画面の決済一覧に「自動分配済」と表示され、
コーチ精算（手動振込）の対象から自動的に外れます。

**法務上の補足**：運営が資金を一旦預かって振り込む現行モデルは、規模や形態に
よっては資金移動業・収納代行の論点が生じ得ます。Connectでは資金の保持・分配を
Stripeが担うため、このリスクを大きく低減できます（最終的な整理は専門家への
確認を推奨します）。

## STEP 5. メール通知（推奨）

1. Firebaseコンソール → Extensions →「**Trigger Email from Firestore**」をインストール
   - ドキュメントコレクション: `mail`
   - SMTP接続情報: SendGrid / Gmail など任意のSMTP
2. `functions/index.js` 冒頭の `APP_URL` に公開URLを設定して再デプロイ：

```bash
firebase deploy --only functions:notifyMail
```

以降、アプリ内通知（いいね・マッチ・契約・支払い・レビュー・審査結果）が
自動でメールにも送信されます。

---

## 公開前チェックリスト

- [ ] FIREBASE_CONFIG を貼り付けた mycoach.html で新規登録→ログインできる
- [ ] firestore.rules を公開した（未公開だと誰でも読み書きできる状態になります）
- [ ] 管理者アカウントに isAdmin: true を設定し、管理画面に入れる
- [ ] コーチ登録→マイページから認証申請→管理画面で承認、の一連が通る
- [ ] 利用規約・プライバシーポリシー・特定商取引法に基づく表記を用意した

## コストの目安

読取コストを抑えるため、アプリ側で対策済みです（通知バッジのポーリングは
本番モードでは30秒間隔、ユーザー情報は30秒キャッシュ）。日常利用が
数百ユーザー規模までは Firestore 無料枠（読取5万/日）内に収まる想定です。

## 運用メモ

- **管理画面**: KPI / ユーザー停止・復帰 / コーチ審査（本人確認書類の閲覧・承認）/
  契約管理 / 決済管理（手数料収益集計・CSV）/ 通報対応
- **退会**: 論理削除（deleted フラグ）。Authアカウント自体の削除が必要な場合は
  Firebaseコンソールから手動削除してください
- **バックアップ**: Firestoreの定期エクスポート設定を推奨
- **特商法・利用規約**: 決済を伴うため、公開前に特定商取引法に基づく表記と
  利用規約・プライバシーポリシーのページをご用意ください
