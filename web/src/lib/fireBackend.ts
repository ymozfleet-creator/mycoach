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
import type { Club, Contract } from './types'
import { inviteCode } from './util'

const strip = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T // undefined を除去
const list = <T>(snap: { docs: { id: string; data: () => any }[] }) => snap.docs.map(d => ({ id: d.id, ...d.data() }) as T)
const sub = (clubId: string, name: string) => collection(db, 'clubs', clubId, name)

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
  setAttendance: async (c, eid, pid, a) => { await updateDoc(doc(db, 'clubs', c, 'events', eid), { [`att.${pid}`]: a }) },

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
  notify: async (to, text, type) => { await addDoc(collection(db, 'notifications'), { to, text: text.slice(0, 300), type, read: false, at: Date.now() }) },
  markRead: async id => { await updateDoc(doc(db, 'notifications', id), { read: true }) },
}
