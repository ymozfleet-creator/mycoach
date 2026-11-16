/* =====================================================================
   MyCOACH Cloud Functions（Stripe決済 + メール通知ブリッジ）
   - createCheckoutSession : 契約金額に連動したStripe Checkoutを作成
   - stripeWebhook         : 決済完了をFirestoreに記録しコーチへ通知
   - notifyMail            : notifications作成時にTrigger Email拡張へ連携
   デプロイ:
     firebase functions:secrets:set STRIPE_SECRET_KEY
     firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
     firebase deploy --only functions
   ===================================================================== */
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
admin.initializeApp();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const STRIPE_WEBHOOK_SECRET_CONNECT = defineSecret('STRIPE_WEBHOOK_SECRET_CONNECT'); // 接続アカウント用宛先の署名シークレット

const REGION = 'asia-northeast1';       // 東京リージョン
const PLAYER_FEE_RATE = 0.10;           // 受講者システム利用料（上乗せ・HTML側と揃える）
const COACH_FEE_RATE = 0.20;            // コーチ事務手数料（控除・HTML側と揃える）
const APP_URL = 'https://mycoach-c15ae.web.app/mycoach-app.html';
const MAIL_APP_URL = 'https://mycoach-c15ae.web.app/app/'; // 通知メールのリンク先（新アプリ） // メール内リンク・決済後の戻り先の既定URL

/* 決済・口座設定の戻り先URLは、許可したサイトだけに限定する（外部サイトへの誘導を防ぐ） */
const ALLOWED_RETURN = ['https://mycoach-c15ae.web.app/', 'https://mycoach-c15ae.firebaseapp.com/', 'https://ymozfleet-creator.github.io/mycoach/', 'https://mycoach-myteam.com/', 'https://www.mycoach-myteam.com/'];
function safeReturn(url, fallback) {
  try {
    const u = new URL(String(url || ''));
    if (u.protocol === 'https:' && ALLOWED_RETURN.some(a => u.href.startsWith(a))) return u.href;
  } catch (e) { /* 不正なURL */ }
  return fallback;
}

/* IDトークン検証：Authorization: Bearer <token> から本人uidを取得する。
   ボディで渡されたuidは信用しない（なりすまし・他人の口座リンク取得の防止） */
async function requireAuth(req, res) {
  const authz = req.headers.authorization || '';
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!idToken) { res.status(401).json({ error: '認証が必要です。再ログインしてお試しください' }); return null; }
  let decoded;
  // checkRevoked=true：パスワード変更・強制ログアウト後の古いトークンは使えない
  try { decoded = await admin.auth().verifyIdToken(idToken, true); }
  catch (e) { res.status(401).json({ error: 'ログインの有効期限が切れています。再ログインしてください' }); return null; }
  // 利用停止・退会済みのアカウントは何もできない
  const u = await admin.firestore().collection('users').doc(decoded.uid).get();
  if (u.exists && (u.data().suspended || u.data().deleted)) { res.status(403).json({ error: 'このアカウントは利用できません' }); return null; }
  // 連打・自動化による悪用を防ぐ（1人あたり1分に20回まで）
  if (!(await rateOk(decoded.uid, 20, 60e3))) { res.status(429).json({ error: '操作が多すぎます。少し時間をおいてお試しください' }); return null; }
  return decoded;
}

/* 1人あたりの呼び出し回数の制限（サーバー専用コレクション rate_limits） */
async function rateOk(uid, max, windowMs) {
  const ref = admin.firestore().collection('rate_limits').doc(uid);
  return admin.firestore().runTransaction(async t => {
    const d = await t.get(ref); const now = Date.now();
    const v = d.exists ? d.data() : { start: now, n: 0 };
    const fresh = now - v.start > windowMs;
    const n = fresh ? 1 : v.n + 1;
    t.set(ref, { start: fresh ? now : v.start, n });
    return n <= max;
  });
}

/* ブラウザからの呼び出しを許可するサイト（それ以外のサイトからは呼べない） */
const CORS_ORIGINS = ['https://ymozfleet-creator.github.io', 'https://mycoach-myteam.com', 'https://www.mycoach-myteam.com', 'https://mycoach-c15ae.web.app', 'https://mycoach-c15ae.firebaseapp.com'];

/* メールアドレスはFirebase Authenticationから取る（公開プロフィールには置かない） */
async function emailOf(uid) {
  try { return (await admin.auth().getUser(uid)).email || ''; } catch (e) { return ''; }
}

/* ---------- 1. Checkoutセッション作成 ---------- */
exports.createCheckoutSession = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const { contractId, origin, returnUrl } = req.body || {};
      const uid = decoded.uid; // 本人のみ。ボディのuidは使用しない
      if (!contractId) { res.status(400).json({ error: 'contractId が必要です' }); return; }

      const snap = await admin.firestore().collection('contracts').doc(contractId).get();
      if (!snap.exists) { res.status(404).json({ error: '契約が見つかりません' }); return; }
      const c = snap.data();
      if (c.player !== uid) { res.status(403).json({ error: 'この契約の支払い権限がありません' }); return; }
      if (c.status !== 'active') { res.status(400).json({ error: '契約中のもののみ支払いできます' }); return; }
      if (!Number.isInteger(Number(c.fee)) || Number(c.fee) < 100 || Number(c.fee) > 100000) { res.status(400).json({ error: '謝金の金額が正しくありません（100円〜100,000円）' }); return; }
      const isClub = !!c.clubId;

      // コーチがStripe Connectの口座設定を完了していれば自動分配（destination charge）
      const coachDoc = await admin.firestore().collection('users').doc(c.coach).get();
      const coach = coachDoc.exists ? coachDoc.data() : {};
      const useConnect = !!(coach.stripeAccountId && coach.stripeChargesEnabled);

      // 手数料モデル：受講者はレッスン料+10%を支払い、コーチはレッスン料-20%を受け取る
      const base = Number(c.fee);
      const playerFee = Math.round(base * PLAYER_FEE_RATE);
      const coachFee = Math.round(base * COACH_FEE_RATE);
      const charge = base + playerFee;   // 受講者の支払総額
      const net = base - coachFee;       // コーチの受取額

      const lineItems = [{
        price_data: {
          currency: 'jpy',
          product_data: { name: isClub ? `指導の謝金：${c.clubName || ''}（${c.title || ''}）` : `MyCOACH レッスン料：${c.title || ''}` },
          unit_amount: base,
        },
        quantity: 1,
      }];
      if (playerFee > 0) {
        lineItems.push({
          price_data: {
            currency: 'jpy',
            product_data: { name: `システム利用料（${Math.round(PLAYER_FEE_RATE*100)}%）` },
            unit_amount: playerFee,
          },
          quantity: 1,
        });
      }

      const params = {
        mode: 'payment',
        line_items: lineItems,
        metadata: {
          contractId, coach: c.coach, player: c.player, ...(isClub ? { clubId: c.clubId } : {}),
          connect: useConnect ? '1' : '0',
          base: String(base), playerFee: String(playerFee),
          coachFee: String(coachFee), net: String(net),
        },
        success_url: returnUrl ? safeReturn(returnUrl, `${APP_URL}?paid=1#contracts`) : `${safeReturn(origin, APP_URL)}?paid=1#contracts`,
        cancel_url: returnUrl ? safeReturn(returnUrl, APP_URL).replace('paid=1', 'paid=0') : `${safeReturn(origin, APP_URL)}#contracts`,
      };
      if (useConnect && isClub) {
        // クラブの指導の謝金：いったん事務局が預かり、指導の実施を確認してから指導者へ送金する
        // （運営の確認、または支払いから7日後に自動。releasePayout / autoReleasePayouts）
        params.payment_intent_data = { transfer_group: `contract_${contractId}` };
      } else if (useConnect) {
        params.payment_intent_data = {
          // プラットフォーム取り分 = 受講者10% + コーチ20%。残額(net)がコーチ口座へ自動送金される
          application_fee_amount: charge - net,
          transfer_data: { destination: coach.stripeAccountId },
        };
      }
      const session = await stripe.checkout.sessions.create(params);
      res.json({ url: session.url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'エラーが発生しました。時間をおいてお試しください' });
    }
  }
);

/* ---------- 2. Stripe Webhook（決済完了の記録） ---------- */
exports.stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET_CONNECT] },
  async (req, res) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    // Stripeは「自アカウント宛先」と「接続アカウント宛先」で署名シークレットが異なるため、
    // 両方のシークレットで順に検証する（どちらで署名されたイベントも1つのURLで受ける）
    let event = null;
    const sig = req.headers['stripe-signature'];
    for (const sec of [STRIPE_WEBHOOK_SECRET.value(), STRIPE_WEBHOOK_SECRET_CONNECT.value()]) {
      if (!sec || sec === 'dummy') continue;
      try { event = stripe.webhooks.constructEvent(req.rawBody, sig, sec); break; }
      catch (e) { /* 次のシークレットで再検証 */ }
    }
    if (!event) { res.status(400).send('Webhook Error: signature verification failed'); return; }

    // 冪等化：同一イベントの二重処理を防止（Stripeはリトライ配信する）
    const evRef = admin.firestore().collection('stripe_events').doc(event.id);
    if ((await evRef.get()).exists) { res.json({ received: true, duplicate: true }); return; }
    await evRef.set({ ts: Date.now(), type: event.type });

    if (event.type === 'checkout.session.completed' && (event.data.object.metadata || {}).kind === 'fee') {
      // MyCOACH-MyTEAM：クラブ会費のカード払い → 会費を「支払い済み」にする
      const s = event.data.object;
      const m = s.metadata;
      const ref = admin.firestore().doc(`clubs/${m.clubId}/fees/${m.feeId}`);
      await ref.update({ status: 'paid', paidAt: Date.now(), method: 'stripe', stripeSessionId: s.id });
      const id = 'fee' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await admin.firestore().collection('club_payments').doc(id).set({
        id, clubId: m.clubId, feeId: m.feeId, payer: m.payer || '', amount: s.amount_total,
        platformFee: Math.round(s.amount_total * CLUB_FEE_RATE), ts: Date.now(), stripeSessionId: s.id,
      });
      res.json({ received: true }); return;
    }
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const m = s.metadata || {};
      const amount = s.amount_total; // 受講者の支払総額（レッスン料+10%）
      const base = Number(m.base) || Math.round(amount / (1 + PLAYER_FEE_RATE));
      const playerFee = Number(m.playerFee) || (amount - base);
      const coachFee = Number(m.coachFee) || Math.round(base * COACH_FEE_RATE);
      const net = Number(m.net) || (base - coachFee);
      const id = 'pay' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

      const viaConnect = m.connect === '1';
      await admin.firestore().collection('payments').doc(id).set({
        id,
        contractId: m.contractId || '',
        ...(m.clubId ? { clubId: m.clubId } : {}),
        coach: m.coach || '',
        player: m.player || '',
        amount, base, playerFee, coachFee,
        fee: playerFee + coachFee, // 事務局収益の合計
        net,                       // コーチ受取額
        ts: Date.now(),
        method: 'stripe',
        stripeSessionId: s.id,
        // 個人レッスン：Connect自動分配ならコーチへの送金は完了済み → 精算対象から除外
        // クラブの謝金：預かり。指導の確認後（または7日後）に送金する
        ...(viaConnect && m.clubId ? { released: false, releaseAt: Date.now() + 7 * 864e5, paymentIntent: String(s.payment_intent || '') }
          : viaConnect ? { payoutId: 'stripe_connect' } : {}),
      });

      if (m.coach) {
        const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await admin.firestore().collection('notifications').doc(nid).set({
          id: nid, to: m.coach, type: 'pay',
          text: m.clubId && viaConnect
            ? `謝金のお支払いがありました。指導の実施が確認されると送金されます（受取額 ¥${Number(net).toLocaleString()}）`
            : `お支払いがありました（あなたの受取額 ¥${Number(net).toLocaleString()}）`,
          link: '#contracts', ts: Date.now(), at: Date.now(), read: false,
        });
      }
    }
    // Connect: コーチ口座の審査状況を同期（Connect Webhookで account.updated を購読）
    if (event.type === 'account.updated') {
      const acct = event.data.object;
      const enabled = !!(acct.charges_enabled && acct.payouts_enabled);
      const q = await admin.firestore().collection('users')
        .where('stripeAccountId', '==', acct.id).get();
      await Promise.all(q.docs.map(d => d.ref.update({ stripeChargesEnabled: enabled })));
      if (enabled && q.docs.length) {
        const uid2 = q.docs[0].id;
        const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await admin.firestore().collection('notifications').doc(nid).set({
          id: nid, to: uid2, type: 'pay',
          text: '受取口座の設定が完了しました。今後のレッスン料は自動で振り込まれます',
          link: '#me', ts: Date.now(), at: Date.now(), read: false,
        });
      }
    }

    res.json({ received: true });
  }
);

/* ---------- 2.2 預かっている謝金を指導者へ送金 ---------- */
// 二重送金を防ぐため、トランザクションで「送金中」にしてから Stripe に依頼し、冪等キーも付ける
async function releaseOne(stripe, paymentId) {
  const ref = admin.firestore().collection('payments').doc(paymentId);
  const claimed = await admin.firestore().runTransaction(async t => {
    const d = await t.get(ref);
    if (!d.exists) return null;
    const p = d.data();
    if (p.released !== false || p.releasing) return null;
    t.update(ref, { releasing: true });
    return p;
  });
  if (!claimed) return false;
  try {
    const coach = (await admin.firestore().collection('users').doc(claimed.coach).get()).data() || {};
    if (!coach.stripeAccountId) throw new Error('no account');
    const pi = await stripe.paymentIntents.retrieve(claimed.paymentIntent);
    const tr = await stripe.transfers.create({
      amount: claimed.net, currency: 'jpy', destination: coach.stripeAccountId,
      transfer_group: `contract_${claimed.contractId}`, source_transaction: pi.latest_charge,
      metadata: { paymentId, contractId: claimed.contractId },
    }, { idempotencyKey: `release_${paymentId}` });
    await ref.update({ released: true, releasing: false, releasedAt: Date.now(), payoutId: tr.id });
    const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    await admin.firestore().collection('notifications').doc(nid).set({
      id: nid, to: claimed.coach, type: 'pay', text: `謝金 ¥${Number(claimed.net).toLocaleString()} を送金しました`,
      link: '#contracts', ts: Date.now(), at: Date.now(), read: false,
    });
    return true;
  } catch (e) {
    console.error('release failed', paymentId, e.message);
    await ref.update({ releasing: false });
    return false;
  }
}

exports.releasePayout = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: CORS_ORIGINS },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).end(); return; }
    const decoded = await requireAuth(req, res); if (!decoded) return;
    const paymentId = String((req.body || {}).paymentId || '');
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(paymentId)) { res.status(400).json({ error: '入力が正しくありません' }); return; }
    const d = await admin.firestore().collection('payments').doc(paymentId).get();
    if (!d.exists) { res.status(404).json({ error: '見つかりません' }); return; }
    const p = d.data();
    // 送金を指示できるのは、支払ったクラブの運営者か事務局だけ（指導者本人は不可）
    const me = (await admin.firestore().collection('users').doc(decoded.uid).get()).data() || {};
    const club = p.clubId ? (await admin.firestore().collection('clubs').doc(p.clubId).get()).data() || {} : {};
    const ok = me.isAdmin === true || (club.adminUids || []).includes(decoded.uid);
    if (!ok) { res.status(403).json({ error: '権限がありません' }); return; }
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    const done = await releaseOne(stripe, paymentId);
    if (!done) { res.status(409).json({ error: 'すでに送金済みか、送金できませんでした' }); return; }
    res.json({ ok: true });
  }
);

// 運営が確認しなくても、支払いから7日たった謝金は自動で送金する（指導者が待たされないように）
exports.autoReleasePayouts = onSchedule({ region: REGION, schedule: '0 10 * * *', timeZone: 'Asia/Tokyo', secrets: [STRIPE_SECRET_KEY] }, async () => {
  const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
  const q = await admin.firestore().collection('payments').where('released', '==', false).where('releaseAt', '<=', Date.now()).limit(100).get();
  for (const d of q.docs) await releaseOne(stripe, d.id);
});

/* ---------- 2.5 Stripe Connect：コーチの口座設定リンク作成 ---------- */
exports.createConnectLink = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const { origin, returnUrl } = req.body || {};
      const uid = decoded.uid; // 本人のコーチアカウントのみ。ボディのuidは使用しない

      const ref = admin.firestore().collection('users').doc(uid);
      const snap = await ref.get();
      if (!snap.exists) { res.status(404).json({ error: 'ユーザーが見つかりません' }); return; }
      const u = snap.data();
      if (u.role !== 'coach') { res.status(403).json({ error: 'コーチのみ設定できます' }); return; }

      let accountId = u.stripeAccountId;
      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'JP',
          email: (await emailOf(uid)) || undefined,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: 'individual',
        });
        accountId = account.id;
        await ref.update({ stripeAccountId: accountId, stripeChargesEnabled: false });
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: returnUrl ? safeReturn(returnUrl, APP_URL).replace('connect=done', 'connect=refresh') : `${safeReturn(origin, APP_URL)}?connect=refresh#me`,
        return_url: returnUrl ? safeReturn(returnUrl, APP_URL) : `${safeReturn(origin, APP_URL)}?connect=done#me`,
        type: 'account_onboarding',
      });
      res.json({ url: link.url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'エラーが発生しました。時間をおいてお試しください' });
    }
  }
);

/* ---------- 2.7 レビュー集計の再計算（整合性の担保・任意） ----------
   有効化すると、レビュー投稿のたびにサーバー側で平均を再計算して上書きします。
   有効化後は firestore.rules の ratingAvg/ratingCount 例外行を削除してください。 */
exports.recalcRating = onDocumentCreated(
  { region: REGION, document: 'reviews/{id}' },
  async (event) => {
    const rv = event.data && event.data.data();
    if (!rv || !rv.to) return;
    const q = await admin.firestore().collection('reviews').where('to', '==', rv.to).get();
    const list = q.docs.map(d => d.data());
    const avg = list.reduce((s, x) => s + Number(x.rating || 0), 0) / (list.length || 1);
    await admin.firestore().collection('users').doc(rv.to).update({
      ratingAvg: Math.round(avg * 10) / 10,
      ratingCount: list.length,
    });
  }
);

/* ---------- 2.8 指導実績カウントの再計算（整合性の担保） ---------- */
exports.recalcLessons = onDocumentCreated(
  { region: REGION, document: 'payments/{id}' },
  async (event) => {
    const p = event.data && event.data.data();
    if (!p || !p.coach) return;
    const q = await admin.firestore().collection('payments').where('coach', '==', p.coach).get();
    await admin.firestore().collection('users').doc(p.coach).update({ lessonCount: q.size });
  }
);

/* ---------- 3. 通知 → メール（Trigger Email拡張ブリッジ） ---------- */
/* 拡張「Trigger Email from Firestore」をインストールし、
   ドキュメントコレクションを "mail" に設定してください。 */
exports.notifyMail = onDocumentCreated(
  { region: REGION, document: 'notifications/{id}' },
  async (event) => {
    const n = event.data && event.data.data();
    if (!n || !n.to) return;
    const u = await admin.firestore().collection('users').doc(n.to).get();
    if (!u.exists || u.data().deleted || u.data().suspended) return;
    const email = await emailOf(n.to);
    if (!email) return;
    // 他の利用者が書いた文章をメールにそのまま載せない（なりすまし・フィッシングに悪用させない）。
    // サーバーが作った通知（決済・審査など）だけ本文を載せ、それ以外は定型文にする
    const trusted = !n.from || n.from === 'system';
    const TITLES = { like: 'いいねが届きました', match: 'マッチが成立しました', msg: '新しいメッセージがあります', contract: '依頼・契約の更新があります', pay: '支払いのお知らせ', review: 'レビューが届きました', verify: '本人確認の結果', cert: '証明書のお知らせ', announce: 'お知らせがあります' };
    const title = TITLES[n.type] || '新しいお知らせがあります';
    await admin.firestore().collection('mail').add({
      to: email,
      message: {
        subject: `【MyCOACH】${title}`,
        text: `${trusted ? String(n.text || '').slice(0, 300) : title + '。内容はアプリでご確認ください。'}\n\nアプリを開いて確認する：\n${MAIL_APP_URL}\n\n※このメールに返信しても届きません。心当たりがない場合は破棄してください。\n※MyCOACHがメールでパスワードやカード番号をお聞きすることはありません。`,
      },
    });
  }
);

/* 公開プロフィール（users）にメールアドレスが書かれたら、非公開の users_private へ移して消す
   （旧データの移行と、万一の書き込みへの安全策） */
exports.protectEmail = onDocumentWritten(
  { region: REGION, document: 'users/{uid}' },
  async (event) => {
    const after = event.data && event.data.after;
    if (!after || !after.exists) return;
    const d = after.data();
    if (!('email' in d)) return;
    if (d.email) await admin.firestore().collection('users_private').doc(event.params.uid).set({ email: d.email }, { merge: true });
    await after.ref.update({ email: admin.firestore.FieldValue.delete() });
  }
);

/* 紹介ページのお問い合わせ（ログイン不要）。入力値を検証し、IPごとに回数を制限して保存、事務局にメールで知らせる */
exports.submitInquiry = onRequest(
  { region: REGION, cors: CORS_ORIGINS, maxInstances: 5 },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'POSTのみ' }); return; }
    try {
      const b = req.body || {};
      const str = (v, max) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
      const d = { name: str(b.name, 40), org: str(b.org, 80), email: str(b.email, 120), role: str(b.role, 30), msg: String(b.msg || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 2000) };
      if (!d.name || !d.org || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { res.status(400).json({ error: '入力内容をご確認ください' }); return; }
      const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
      const key = 'ip_' + require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 32); // IPそのものは保存しない
      if (!(await rateOk(key, 5, 60 * 60e3))) { res.status(429).json({ error: '送信回数が多すぎます。時間をおいてお試しください' }); return; }
      const ref = await admin.firestore().collection('inquiries').add({ ...d, at: Date.now(), status: 'new' });
      const admins = await admin.firestore().collection('users').where('isAdmin', '==', true).limit(10).get();
      for (const a of admins.docs) {
        const to = await emailOf(a.id);
        if (to) await admin.firestore().collection('mail').add({ to, message: { subject: `【MyCOACH-MyTEAM】導入のご相談：${d.org}`, text: `紹介ページからご相談が届きました（受付番号 ${ref.id}）。\n\nお名前：${d.name}\n団体名：${d.org}\nご立場：${d.role}\nメール：${d.email}\n\n${d.msg}` } });
      }
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'エラーが発生しました。時間をおいてお試しください' }); }
  }
);

/* 新しい募集が出たら、条件の合う近くの指導者（本人確認・安全研修済み）にお知らせする。
   指導者の一覧をサーバー側で照合するので、利用者の画面に他人の情報を配らずに済む */
const kmBetween = (a, b, c, d) => { const R = 6371, r = x => x * Math.PI / 180, dLat = r(c - a), dLon = r(d - b); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
exports.notifyNewPost = onDocumentCreated(
  { region: REGION, document: 'club_posts/{id}' },
  async (event) => {
    const p = event.data && event.data.data();
    if (!p || p.status !== 'open' || !p.sport) return;
    const q = await admin.firestore().collection('users').where('sports', 'array-contains', p.sport).where('role', '==', 'coach').limit(300).get();
    const batch = admin.firestore().batch(); let n = 0;
    for (const d of q.docs) {
      const u = d.data();
      if (d.id === p.ownerUid || u.deleted || u.suspended || u.verified !== 'approved' || !u.training || (u.clubIds || []).includes(p.clubId)) continue;
      if (u.lat == null || u.lon == null || kmBetween(p.lat, p.lon, u.lat, u.lon) > 15) continue;
      const dayOk = !(p.days || []).length || (p.days || []).some(x => (u.days || []).includes(x));
      if (!dayOk) continue;
      batch.set(admin.firestore().collection('notifications').doc(), { to: d.id, type: 'match', read: false, at: Date.now(), ts: Date.now(), link: '#/match', text: `【新着の募集】${String(p.clubName || '').slice(0, 40)}「${String(p.title || '').slice(0, 40)}」があなたの条件に合います` });
      if (++n >= 50) break;
    }
    if (n) await batch.commit();
  }
);

/* 毎朝9時(JST)：翌日にレッスン予定（予約確定済み）がある契約の両者へリマインド通知。
   通知ドキュメントは notifyMail がメール転送するため、Trigger Email 導入済みならメールも届く */
exports.lessonReminder = onSchedule({ region: REGION, schedule: '0 9 * * *', timeZone: 'Asia/Tokyo' }, async () => {
  const db = admin.firestore();
  const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
  const t0 = Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate() + 1) - 9 * 3600 * 1000;
  const t1 = t0 + 24 * 3600 * 1000;
  const q = await db.collection('contracts').where('status', '==', 'active').get();
  for (const doc of q.docs) {
    const c = doc.data();
    if (!c.nextLessonAt || c.nextLessonAt < t0 || c.nextLessonAt >= t1) continue;
    for (const u of [c.coach, c.player]) {
      if (!u) continue;
      const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 8);
      await db.collection('notifications').doc(id).set({
        id, to: u, type: 'contract',
        text: `明日はレッスン予定日です：${c.nextLesson || ''}（${c.title || ''}）`,
        link: '#contracts', ts: Date.now(), at: Date.now(), read: false,
      });
    }
  }
});


/* =====================================================================
   MyCOACH-MyTEAM（地域クラブ運営）用
   ===================================================================== */
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const CLUB_FEE_RATE = 0.05;      // 会費集金の手数料（5%）。サービス紹介ページの表記と揃える
const AI_DAILY_LIMIT = 30;       // 1人1日あたりのAI利用回数の上限

/* ---------- 会費のカード払い（Stripe Checkout） ---------- */
exports.createFeeCheckout = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: CORS_ORIGINS },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const { clubId, feeId, origin } = req.body || {};
      if (!clubId || !feeId) { res.status(400).json({ error: 'clubId / feeId が必要です' }); return; }
      const snap = await admin.firestore().doc(`clubs/${clubId}/fees/${feeId}`).get();
      if (!snap.exists) { res.status(404).json({ error: '請求が見つかりません' }); return; }
      const f = snap.data();
      if (!(f.guardianUids || []).includes(decoded.uid)) { res.status(403).json({ error: 'この請求の支払い権限がありません' }); return; }
      if (f.status !== 'unpaid') { res.status(400).json({ error: 'この請求はお支払い済みです' }); return; }
      const clubSnap = await admin.firestore().doc(`clubs/${clubId}`).get();
      const clubName = clubSnap.exists ? clubSnap.data().name : '';
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const back = safeReturn(origin, APP_URL);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price_data: { currency: 'jpy', product_data: { name: `${clubName} 会費（${f.playerName}さん・${f.month}）` }, unit_amount: Number(f.amount) }, quantity: 1 }],
        metadata: { kind: 'fee', clubId, feeId, payer: decoded.uid },
        success_url: `${back}${back.includes('?') ? '&' : '?'}paid=1`,
        cancel_url: back,
      });
      res.json({ url: session.url });
    } catch (e) { console.error(e); res.status(500).json({ error: 'エラーが発生しました。時間をおいてお試しください' }); }
  }
);

/* ---------- AIアシスト（練習メニュー作成） ---------- */
exports.aiAssist = onRequest(
  { region: REGION, secrets: [ANTHROPIC_API_KEY], cors: CORS_ORIGINS, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const day = new Date().toISOString().slice(0, 10);
      const uref = admin.firestore().doc(`ai_usage/${decoded.uid}_${day}`);
      const used = await admin.firestore().runTransaction(async t => {
        const d = await t.get(uref); const n = (d.exists ? d.data().n : 0) + 1;
        t.set(uref, { n, uid: decoded.uid, day }); return n;
      });
      if (used > AI_DAILY_LIMIT) { res.status(429).json({ error: '本日のAI利用回数の上限に達しました' }); return; }

      const { type, input } = req.body || {};
      if (type !== 'menu' || !input) { res.status(400).json({ error: '不正なリクエストです' }); return; }
      const i = {
        sport: String(input.sport || '').slice(0, 30), goal: String(input.goal || '').slice(0, 30),
        minutes: Math.min(240, Math.max(30, Number(input.minutes) || 120)), players: Math.min(80, Math.max(1, Number(input.players) || 10)),
        wbgt: input.wbgt == null ? null : Number(input.wbgt), level: String(input.level || '').slice(0, 10), note: String(input.note || '').slice(0, 200),
      };
      const prompt = `あなたは日本の中学生・高校生の部活動（地域クラブ）を指導する経験豊富なコーチです。次の条件で練習メニューを作ってください。
種目：${i.sport}／ねらい：${i.goal}／練習時間：${i.minutes}分／参加人数：${i.players}人／レベル：${i.level}
暑さ指数（WBGT）：${i.wbgt == null ? '不明' : i.wbgt}（日本スポーツ協会の熱中症予防運動指針に従い、25以上は30分おき、28以上は15〜20分おきに休憩を入れ、激しい運動を避ける。31以上は運動を原則中止とし、その旨をpointsに書く）
指導者のメモ：${i.note || 'なし'}
条件：ウォームアップとクールダウンを含め、合計がちょうど${i.minutes}分になるよう時間を割り振る。成長期の選手に無理のない内容にする。
出力はJSONのみ。形式：{"blocks":[{"from":0,"to":15,"title":"短い名前","detail":"やり方を1文","caution":"注意点があれば1文（なければ省略）"}],"points":["指導のポイントを1文","..."]}`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY.value(), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!r.ok) { console.error('anthropic', r.status, await r.text()); res.status(502).json({ error: 'AIの呼び出しに失敗しました' }); return; }
      const j = await r.json();
      const text = (j.content || []).map(c => c.text || '').join('');
      const m = text.match(/\{[\s\S]*\}/);
      const out = m ? JSON.parse(m[0]) : null;
      if (!out || !Array.isArray(out.blocks)) { res.status(502).json({ error: 'AIの応答を読み取れませんでした' }); return; }
      res.json({ blocks: out.blocks.slice(0, 20), points: (out.points || []).slice(0, 6) });
    } catch (e) { console.error(e); res.status(500).json({ error: 'エラーが発生しました。時間をおいてお試しください' }); }
  }
);
