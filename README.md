# MyCOACH-MyTEAM — 部活動の地域展開 運営基盤

部活動の地域展開（2026〜2031年度「改革実行期間」）に取り組む自治体・地域クラブ運営団体向けの運営基盤。運営：RELIGHT

## 構成

```
index.html        サービス紹介ページ（自治体・地域クラブ運営団体向け）
app.html          地域クラブ運営コンソール（デモ。ブラウザ内保存で単体動作）
mycoach-app.html  MyCOACHアプリ本体（指導者マッチング・チャット・契約・Stripe決済。旧 index.html）
sw.js          Service Worker（HTMLはネットワーク優先・3秒で保存版に切替）
manifest.json  PWA設定
functions/     Cloud Functions（Stripe決済・通知）
firestore.rules / storage.rules / setup/   Firebase設定
cosapo/        コサポ一式（退避・温存）
```

## 主な機能（app.html）

| 機能 | 中身 |
|---|---|
| 指導者マッチング | 距離・曜日・資格・審査（本人確認/安全研修）・評価から100点満点のマッチ度。内訳つき。審査未了は依頼不可 |
| 安全管理 | Open-Meteoの予報（気温・湿度・日射・風速）から環境省採用の推定式でWBGTを1時間ごとに推定。JSPO指針の5段階で判定、保護者への連絡文案、ケガ・ヒヤリハット記録 |
| 練習・コンディション | RPE×時間の練習負荷、直近7日／過去4週平均の負荷比（ACWR）と睡眠で要注意者を検知。目的・時間・人数・暑さ指数に応じた練習メニュー案 |
| 会費・出欠 | 月会費の回収状況、家庭ごとの減免（50%・全額）、未納への督促文案、出欠率 |
| 自治体への実績報告 | 活動回数・時間・延べ参加人数・指導者・会費・安全記録を月ごとに自動集計。CSV出力・印刷 |

- 練習メニューは内蔵ロジックで作成。`app.html` の `AI_MENU_ENDPOINT` に生成AIのAPI（Cloud Functions等）を設定すると、そちらで作成する
- お問い合わせフォームの送信先は `index.html` の `CONTACT_EMAIL` に設定する（未設定時は「準備中」と表示）

## 画面の動き・スマホ表示

- サービス紹介：スクロールに合わせた表示アニメーション、数字のカウントアップ、スマホでは課題・安全・料金・導入の流れを横スワイプ（ページ送りドットつき）、読み進め具合のバー、下部に固定の相談ボタン
- 運営コンソール：スマホは画面下のタブバーで操作、画面切替にView Transitions APIのアニメーション、要約の数字は横スワイプ、時間ごとの暑さ指数は横スクロール、確認画面は下から出るシート表示
- 「動きを減らす」設定の端末ではアニメーションを止める

## 表示速度の対策

- Webフォントを非同期読み込みに変更（フォント待ちで画面が白くならない）
- Service Workerを刷新：HTMLは常に最新を取りに行き、3秒以内に返らない場合のみ保存版を表示。版を上げると古いキャッシュは自動削除
- Firebase Hosting：HTMLと `sw.js` に `Cache-Control: no-cache`

## MyCOACHアプリ本体（mycoach-app.html）

- そのまま開くとデモモード（localStorage）で全機能を体験できる
- ファイル冒頭の `FIREBASE_CONFIG` を設定すると本番モード（Firebase Auth + Firestore）
- 本番セットアップは `setup/SETUP.md`（Firebase／セキュリティルール／Stripe／Stripe Connect／メール通知）
- 機能：マッチング（競技×エリア×指導形態）／リアルタイムチャット／契約（提案→承諾→完了）／Stripe決済・コーチ精算・Connect自動分配／レビュー／認証コーチ審査／通知／管理画面

## 公開（GitHub Pages）

Settings → Pages → Branch: main / root で `https://ymozfleet-creator.github.io/mycoach/` に公開される。
