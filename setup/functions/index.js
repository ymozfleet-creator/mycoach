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
        link: '#contracts', ts: Date.now(), read: false,
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
  { region: REGION, secrets: [STRIPE_SECRET_KEY], cors: true },
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
      const back = origin || APP_URL;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price_data: { currency: 'jpy', product_data: { name: `${clubName} 会費（${f.playerName}さん・${f.month}）` }, unit_amount: Number(f.amount) }, quantity: 1 }],
        metadata: { kind: 'fee', clubId, feeId, payer: decoded.uid },
        success_url: `${back}${back.includes('?') ? '&' : '?'}paid=1`,
        cancel_url: back,
      });
      res.json({ url: session.url });
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  }
);

/* ---------- AIアシスト（練習メニュー作成） ---------- */
exports.aiAssist = onRequest(
  { region: REGION, secrets: [ANTHROPIC_API_KEY], cors: true, timeoutSeconds: 60 },
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
    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  }
);
