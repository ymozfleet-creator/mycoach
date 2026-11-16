import {
  GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from 'firebase/auth'
import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  setDoc, updateDoc, where,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Backend } from './backend'
import type { Club, Contract, Payment, Profile, VerifyDoc } from './types'
import { FUNCTIONS_BASE } from './config'
import { inviteCode } from './util'

const strip = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T // undefined を除去
const list = <T>(snap: { docs: { id: string; data: () => any }[] }) => snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)
const sub = (clubId: string, name: string) => collection(db, 'clubs', clubId, name)
const longCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')

/** Cloud Functions の呼び出し。本人確認は IDトークンでサーバー側が行う */
async function callFn(name: string, body: object): Promise<string> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('ログインし直してください')
  const r = await fetch(`${FUNCTIONS_BASE}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.url) throw new Error(j.error || '手続きを開始できませんでした。時間をおいてお試しください')
  return j.url as string
}

export const fireBackend: Backend = {
  mode: 'firebase',
  onAuth: cb => onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)),
  signInEmail: async (e, p) => { await signInWithEmailAndPassword(auth, e, p) },
  signUpEmail: async (e, p) => { await createUserWithEmailAndPassword(auth, e, p) },
  signInGoogle: async () => { await signInWithPopup(auth, new GoogleAuthProvider()) },
  resetPassword: e => sendPasswordResetEmail(auth, e),
  signOut: () => signOut(auth),

  watchProfile: (uid, cb) => onSnapshot(doc(db, 'users', uid), s => cb(s.exists() ? ({ uid, clubIds: [], ...s.data() } as any) : null), () => cb(null)),
  saveProfile: async p => { await setDoc(doc(db, 'users', p.uid), strip(p), { merge: true }) },

  createClub: async c => {
    const code = inviteCode(), coachCode = inviteCode(), schoolCode = inviteCode()
    const ref = doc(collection(db, 'clubs'))
    const club: Omit<Club, 'id'> = { ...c, inviteCode: code, coachCode, schoolCode, adminUids: [c.ownerUid], coachUids: [], schoolUids: [], memberUids: [c.ownerUid] }
    await setDoc(ref, strip(club))
    await setDoc(doc(db, 'invites', code), { clubId: ref.id, role: 'member' })
    await setDoc(doc(db, 'invites', coachCode), { clubId: ref.id, role: 'coach' })
    await setDoc(doc(db, 'invites', schoolCode), { clubId: ref.id, role: 'school' })
    await setDoc(doc(db, 'users', c.ownerUid), { clubIds: arrayUnion(ref.id) }, { merge: true })
    return ref.id
  },
  joinClub: async (raw, uid) => {
    const code = raw.trim().toUpperCase()
    const inv = await getDoc(doc(db, 'invites', code))
    if (!inv.exists()) throw new Error('招待コードが見つかりません。運営の方にコードをご確認ください。')
    const { clubId, role } = inv.data() as { clubId: string; role?: string }
    const extra = role === 'coach' ? { coachUids: arrayUnion(uid) } : role === 'school' ? { schoolUids: arrayUnion(uid) } : {}
    await updateDoc(doc(db, 'clubs', clubId), { memberUids: arrayUnion(uid), ...extra, joinCode: code })
    await setDoc(doc(db, 'users', uid), { clubIds: arrayUnion(clubId) }, { merge: true })
    return clubId
  },
  watchClub: (id, cb) => onSnapshot(doc(db, 'clubs', id), s => cb(s.exists() ? ({ id, ...s.data() } as Club) : null), () => cb(null)),
  updateClub: async (id, patch) => { await updateDoc(doc(db, 'clubs', id), strip(patch) as any) },

  watchPlayers: (c, g, cb) => onSnapshot(g ? query(sub(c, 'players'), where('guardianUids', 'array-contains', g)) : query(sub(c, 'players'), orderBy('name')), s => cb(list(s)), () => cb([])),
  savePlayer: async (c, p) => { const { id, ...rest } = p; await setDoc(doc(db, 'clubs', c, 'players', id), strip(rest)) },
  removePlayer: async (c, id) => { await deleteDoc(doc(db, 'clubs', c, 'players', id)) },

  watchEvents: (c, from, cb) => onSnapshot(query(sub(c, 'events'), where('date', '>=', from), orderBy('date')), s => cb(list(s)), () => cb([])),
  saveEvent: async (c, e) => { const { id, ...rest } = e; await setDoc(doc(db, 'clubs', c, 'events', id), strip(rest)) },
  setAttendance: async (c, eid, pid, a) => { await updateDoc(doc(db, 'clubs', c, 'events', eid), { [`att.${pid}`]: a, attBy: { p: pid, u: auth.currentUser?.uid || '' } }) },

  watchAnnouncements: (c, cb) => onSnapshot(query(sub(c, 'announcements'), orderBy('at', 'desc'), limit(30)), s => cb(list(s)), () => cb([])),
  postAnnouncement: async (c, a) => { await addDoc(sub(c, 'announcements'), strip(a)) },

  watchConditions: (c, from, by, cb) => onSnapshot(by ? query(sub(c, 'conditions'), where('by', '==', by), where('date', '>=', from)) : query(sub(c, 'conditions'), where('date', '>=', from)), s => cb(list(s)), () => cb([])),
  addCondition: async (c, x) => { await addDoc(sub(c, 'conditions'), strip(x)) },

  watchFees: (c, month, uid, isAdmin, cb) => {
    const q = isAdmin ? query(sub(c, 'fees'), where('month', '==', month)) : query(sub(c, 'fees'), where('month', '==', month), where('guardianUids', 'array-contains', uid))
    return onSnapshot(q, s => cb(list(s)), () => cb([]))
  },
  saveFee: async (c, f) => { const { id, ...rest } = f; await setDoc(doc(db, 'clubs', c, 'fees', id), strip(rest)) },

  watchIncidents: (c, cb) => onSnapshot(query(sub(c, 'incidents'), orderBy('date', 'desc')), s => cb(list(s)), () => cb([])),
  addIncident: async (c, i) => { await addDoc(sub(c, 'incidents'), strip(i)) },

  listCoaches: async sport => {
    const s = await getDocs(query(collection(db, 'users'), where('role', '==', 'coach'), where('sports', 'array-contains', sport), limit(50)))
    return s.docs.map(d => ({ uid: d.id, clubIds: [], ...d.data() }) as any)
  },
  addCoach: async (clubId, uid) => { await updateDoc(doc(db, 'clubs', clubId), { coachUids: arrayUnion(uid), memberUids: arrayUnion(uid) }) },
  createCoachInvite: async clubId => { const code = longCode(); await setDoc(doc(db, 'invites', code), { clubId, role: 'coach' }); return code },

  watchOpenPosts: cb => onSnapshot(query(collection(db, 'club_posts'), where('status', '==', 'open'), limit(100)), s => cb(list<any>(s).sort((a, b) => b.at - a.at)), () => cb([])),
  watchClubPosts: (clubId, cb) => onSnapshot(query(collection(db, 'club_posts'), where('clubId', '==', clubId)), s => cb(list<any>(s).sort((a, b) => b.at - a.at)), () => cb([])),
  savePost: async p => { const { id, ...rest } = p; await setDoc(doc(db, 'club_posts', id), strip(rest)) },

  submitVerification: async d => {
    await setDoc(doc(db, 'verify_docs', d.uid), strip(d))
    await setDoc(doc(db, 'users', d.uid), { verified: 'pending', verifyNote: '' }, { merge: true })
  },
  getVerifyDoc: async uid => { const s = await getDoc(doc(db, 'verify_docs', uid)); return s.exists() ? (s.data() as VerifyDoc) : null },
  watchPendingVerifications: cb => onSnapshot(query(collection(db, 'users'), where('verified', '==', 'pending'), limit(100)), s => cb(s.docs.map(d => ({ uid: d.id, clubIds: [], ...d.data() }) as unknown as Profile)), () => cb([])),
  decideVerification: async (uid, ok, note, licenseOk) => {
    await updateDoc(doc(db, 'users', uid), { verified: ok ? 'approved' : 'none', verifyNote: ok ? '' : note.slice(0, 300), licenseVerified: !!(ok && licenseOk) })
    // 承認後は身分証の画像を残さない（必要最小限の保管）
    if (ok) await deleteDoc(doc(db, 'verify_docs', uid)).catch(() => {})
    await addDoc(collection(db, 'audit_logs'), { action: ok ? 'verify_approve' : 'verify_reject', target: uid, by: auth.currentUser?.uid || '', note: note.slice(0, 300), at: Date.now() })
    await addDoc(collection(db, 'notifications'), { to: uid, from: auth.currentUser?.uid || '', type: 'verify', read: false, at: Date.now(), text: ok ? '本人確認が完了しました。クラブへの応募・依頼の受付ができます' : `本人確認の書類を再提出してください：${note}`.slice(0, 300) })
  },

  watchPayments: (uid, cb) => {
    let a: Payment[] = [], b: Payment[] = []
    const emit = () => cb([...a, ...b.filter(x => !a.find(y => y.id === x.id))].sort((x, y) => y.ts - x.ts))
    const u1 = onSnapshot(query(collection(db, 'payments'), where('coach', '==', uid)), s => { a = list(s); emit() }, () => {})
    const u2 = onSnapshot(query(collection(db, 'payments'), where('player', '==', uid)), s => { b = list(s); emit() }, () => {})
    return () => { u1(); u2() }
  },
  payContract: async (contractId, returnUrl) => callFn('createCheckoutSession', { contractId, returnUrl }),
  connectPayout: async returnUrl => callFn('createConnectLink', { returnUrl }),
  addReview: async r => {
    // 平均点の集計はサーバー（recalcRating）が行う
    await setDoc(doc(db, 'reviews', `${r.contractId}_${r.from}`), strip({ ...r, ts: r.at }))
    await updateDoc(doc(db, 'contracts', r.contractId), { reviewed: true })
  },
  releasePayment: async paymentId => {
    const token = await auth.currentUser?.getIdToken()
    const r = await fetch(`${FUNCTIONS_BASE}/releasePayout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ paymentId }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || '送金できませんでした')
  },
  watchSub: (c, name, cb, onlyBy) => onSnapshot(onlyBy ? query(sub(c, name), where('by', '==', onlyBy)) : query(sub(c, name), limit(200)), s => cb(list<any>(s).sort((a, b) => (b.at || 0) - (a.at || 0))), () => cb([])),
  addSub: async (c, name, data, id) => { id ? await setDoc(doc(db, 'clubs', c, name, id), strip(data)) : await addDoc(sub(c, name), strip(data)) },
  updateSub: async (c, name, id, patch) => { await updateDoc(doc(db, 'clubs', c, name, id), strip(patch) as any) },
  addReport: async r => { await addDoc(collection(db, 'reports'), strip(r)) },
  watchReports: cb => onSnapshot(query(collection(db, 'reports'), where('status', '==', 'new'), limit(100)), s => cb(list<any>(s).sort((a, b) => b.at - a.at)), () => cb([])),
  resolveReport: async id => { await updateDoc(doc(db, 'reports', id), { status: 'done' }) },
  moderate: async (type, id) => {
    if (type === 'user') await updateDoc(doc(db, 'users', id), { photo: '' })
    if (type === 'club') await updateDoc(doc(db, 'clubs', id), { photo: '' })
    if (type === 'post') await updateDoc(doc(db, 'club_posts', id), { photo: '', status: 'closed' })
    await addDoc(collection(db, 'audit_logs'), { action: 'moderate_' + type, target: id, by: auth.currentUser?.uid || '', note: '', at: Date.now() })
  },
  watchContracts: (uid, cb) => {
    let a: Contract[] = [], b: Contract[] = []
    const emit = () => cb([...a, ...b.filter(x => !a.find(y => y.id === x.id))].sort((x, y) => (y.at || 0) - (x.at || 0)))
    const u1 = onSnapshot(query(collection(db, 'contracts'), where('coach', '==', uid)), s => { a = list<Contract>(s).filter(x => x.clubId); emit() }, () => {})
    const u2 = onSnapshot(query(collection(db, 'contracts'), where('player', '==', uid)), s => { b = list<Contract>(s).filter(x => x.clubId); emit() }, () => {})
    return () => { u1(); u2() }
  },
  createContract: async c => (await addDoc(collection(db, 'contracts'), strip(c))).id,
  setContractStatus: async (id, s) => { await updateDoc(doc(db, 'contracts', id), { status: s }) },
  watchMessages: (id, cb) => onSnapshot(query(collection(db, 'contracts', id, 'messages'), orderBy('at')), s => cb(list(s)), () => cb([])),
  sendMessage: async (id, m) => { await addDoc(collection(db, 'contracts', id, 'messages'), strip(m)) },

  watchNotices: (uid, cb) => onSnapshot(query(collection(db, 'notifications'), where('to', '==', uid), orderBy('at', 'desc'), limit(30)), s => cb(list(s)), () => cb([])),
  notify: async (to, text, type) => { await addDoc(collection(db, 'notifications'), { to, from: auth.currentUser?.uid || '', text: text.slice(0, 300), type, read: false, at: Date.now() }) },
  markRead: async id => { await updateDoc(doc(db, 'notifications', id), { read: true }) },
}
