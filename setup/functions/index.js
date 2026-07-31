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
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
admin.initializeApp();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

const REGION = 'asia-northeast1';       // 東京リージョン
const PLAYER_FEE_RATE = 0.10;           // 受講者システム利用料（上乗せ・HTML側と揃える）
const COACH_FEE_RATE = 0.20;            // コーチ事務手数料（控除・HTML側と揃える）
const APP_URL = 'https://ymozfleet-creator.github.io/mycoach/index.html'; // メール内リンク・決済後の戻り先の既定URL

/* IDトークン検証：Authorization: Bearer <token> から本人uidを取得する。
   ボディで渡されたuidは信用しない（なりすまし・他人の口座リンク取得の防止） */
async function requireAuth(req, res) {
  const authz = req.headers.authorization || '';
  const idToken = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!idToken) { res.status(401).json({ error: '認証が必要です。再ログインしてお試しください' }); return null; }
  try { return await admin.auth().verifyIdToken(idToken); }
  catch (e) { res.status(401).json({ error: 'ログインの有効期限が切れています。再ログインしてください' }); return null; }
}

/* ---------- 1. Checkoutセッション作成 ---------- */
exports.createCheckoutSession = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const { contractId, origin } = req.body || {};
      const uid = decoded.uid; // 本人のみ。ボディのuidは使用しない
      if (!contractId) { res.status(400).json({ error: 'contractId が必要です' }); return; }

      const snap = await admin.firestore().collection('contracts').doc(contractId).get();
      if (!snap.exists) { res.status(404).json({ error: '契約が見つかりません' }); return; }
      const c = snap.data();
      if (c.player !== uid) { res.status(403).json({ error: 'この契約の支払い権限がありません' }); return; }
      if (c.status !== 'active') { res.status(400).json({ error: '契約中のもののみ支払いできます' }); return; }

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
          product_data: { name: `MyCOACH レッスン料：${c.title || ''}` },
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
          contractId, coach: c.coach, player: c.player,
          connect: useConnect ? '1' : '0',
          base: String(base), playerFee: String(playerFee),
          coachFee: String(coachFee), net: String(net),
        },
        success_url: `${origin || APP_URL}?paid=1#contracts`,
        cancel_url: `${origin || APP_URL}#contracts`,
      };
      if (useConnect) {
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
      res.status(500).json({ error: e.message });
    }
  }
);

/* ---------- 2. Stripe Webhook（決済完了の記録） ---------- */
exports.stripeWebhook = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (e) {
      res.status(400).send(`Webhook Error: ${e.message}`); return;
    }

    // 冪等化：同一イベントの二重処理を防止（Stripeはリトライ配信する）
    const evRef = admin.firestore().collection('stripe_events').doc(event.id);
    if ((await evRef.get()).exists) { res.json({ received: true, duplicate: true }); return; }
    await evRef.set({ ts: Date.now(), type: event.type });

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
        coach: m.coach || '',
        player: m.player || '',
        amount, base, playerFee, coachFee,
        fee: playerFee + coachFee, // 事務局収益の合計
        net,                       // コーチ受取額
        ts: Date.now(),
        method: 'stripe',
        stripeSessionId: s.id,
        // Connect自動分配ならコーチへの送金は完了済み → 精算対象から除外
        ...(viaConnect ? { payoutId: 'stripe_connect' } : {}),
      });

      if (m.coach) {
        const nid = 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await admin.firestore().collection('notifications').doc(nid).set({
          id: nid, to: m.coach, type: 'pay',
          text: `お支払いがありました（あなたの受取額 ¥${Number(net).toLocaleString()}）`,
          link: '#contracts', ts: Date.now(), read: false,
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
          link: '#me', ts: Date.now(), read: false,
        });
      }
    }

    res.json({ received: true });
  }
);

/* ---------- 2.5 Stripe Connect：コーチの口座設定リンク作成 ---------- */
exports.createConnectLink = onRequest(
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: true },
  async (req, res) => {
    try {
      if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
      const decoded = await requireAuth(req, res); if (!decoded) return;
      const stripe = require('stripe')(STRIPE_SECRET_KEY.value());
      const { origin } = req.body || {};
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
          email: u.email,
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_type: 'individual',
        });
        accountId = account.id;
        await ref.update({ stripeAccountId: accountId, stripeChargesEnabled: false });
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${origin || APP_URL}?connect=refresh#me`,
        return_url: `${origin || APP_URL}?connect=done#me`,
        type: 'account_onboarding',
      });
      res.json({ url: link.url });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
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
    const email = u.exists && u.data().email;
    if (!email || u.data().deleted) return;

    await admin.firestore().collection('mail').add({
      to: email,
      message: {
        subject: `【MyCOACH】${n.text}`,
        text: `${n.text}\n\nMyCOACHを開いて確認する：\n${APP_URL || 'アプリのURL'}${n.link || ''}\n\n※このメールに心当たりがない場合は破棄してください。`,
      },
    });
  }
);
