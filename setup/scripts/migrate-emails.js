/* 一度だけ実行：公開プロフィール（users）に残っている旧データのメールアドレスを
   非公開の users_private に移して、users からは削除する。
   実行方法（管理者のPCで）:
     gcloud auth application-default login
     cd setup/functions && node ../scripts/migrate-emails.js mycoach-c15ae
*/
const admin = require('firebase-admin');
admin.initializeApp({ projectId: process.argv[2] || 'mycoach-c15ae' });
(async () => {
  const db = admin.firestore();
  const snap = await db.collection('users').get();
  let moved = 0;
  for (const d of snap.docs) {
    const e = d.data().email;
    if (e === undefined) continue;
    if (e) await db.collection('users_private').doc(d.id).set({ email: e }, { merge: true });
    await d.ref.update({ email: admin.firestore.FieldValue.delete() });
    moved++;
  }
  console.log(`完了：${snap.size}件中 ${moved}件のメールアドレスを非公開領域へ移しました`);
})().catch(e => { console.error(e); process.exit(1); });
