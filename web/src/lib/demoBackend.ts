import type { Backend } from './backend'
import type { Announcement, Club, ClubEvent, Condition, Contract, Fee, Incident, Message, Notice, Player, Profile } from './types'
import { addDays, inviteCode, iso, monthOf, today, uid6 } from './util'

/** デモ：ブラウザ内（localStorage）に保存。営業時のデモや、本番ルール反映前の確認に使う */
interface DB {
  v: number
  auth: string | null
  users: Record<string, Profile>
  clubs: Record<string, Club>
  invites: Record<string, string>
  players: Record<string, Player[]>
  events: Record<string, ClubEvent[]>
  ann: Record<string, Announcement[]>
  conds: Record<string, Condition[]>
  fees: Record<string, Fee[]>
  inc: Record<string, Incident[]>
  contracts: Contract[]
  msgs: Record<string, Message[]>
  notices: Notice[]
}
const KEY = 'mcmt_demo_v6'
export const DEMO_USERS = { admin: 'demo-admin', coach: 'demo-coach', member: 'demo-member', school: 'demo-school' } as const

function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 } }

function seed(): DB {
  const r = rng(7)
  const T = today()
  const clubId = 'club-nakano'
  const users: Record<string, Profile> = {
    'demo-admin': { uid: 'demo-admin', name: '田中 恵', role: 'admin', clubIds: [clubId] },
    'demo-member': { uid: 'demo-member', name: '加藤 由美', role: 'member', clubIds: [clubId] },
    'demo-school': { uid: 'demo-school', name: '高橋 誠', role: 'school', clubIds: [clubId], org: '中野区立第五中学校' },
    'demo-coach': { uid: 'demo-coach', name: '佐藤 健太', role: 'coach', clubIds: [clubId], sports: ['バスケットボール'], areaLabel: '中野区', lat: 35.715, lon: 139.65, days: [6, 0, 3], license: 'JSPO公認コーチ1', verified: 'approved', training: true, ratingAvg: 4.8, ratingCount: 126, lessonCount: 126, bio: '元実業団。基礎とディフェンスの指導が得意です。' },
    'c2': { uid: 'c2', name: '山田 美咲', role: 'coach', clubIds: [], sports: ['バスケットボール'], areaLabel: '新宿区', lat: 35.69, lon: 139.7, days: [6], license: '元実業団選手', verified: 'approved', training: true, ratingAvg: 4.9, ratingCount: 88, lessonCount: 88, bio: 'シュート指導が専門です。' },
    'c3': { uid: 'c3', name: '鈴木 大輔', role: 'coach', clubIds: [], sports: ['バスケットボール'], areaLabel: '中野区', lat: 35.712, lon: 139.655, days: [6, 0], license: 'JSPO公認スタートコーチ', verified: 'approved', training: false, teacher: true, ratingAvg: 4.5, ratingCount: 40, lessonCount: 40, bio: '中学校教員（兼職兼業の許可済み）。' },
    'c4': { uid: 'c4', name: '伊藤 さくら', role: 'coach', clubIds: [], sports: ['バスケットボール'], areaLabel: '杉並区', lat: 35.705, lon: 139.68, days: [6, 0, 5], license: 'JSPO公認コーチ3', verified: 'approved', training: true, ratingAvg: 4.7, ratingCount: 210, lessonCount: 210, bio: '小中学生の育成年代を15年指導。' },
    'c5': { uid: 'c5', name: '高橋 翔', role: 'coach', clubIds: [], sports: ['バスケットボール'], areaLabel: '練馬区', lat: 35.76, lon: 139.6, days: [0, 2], license: '', verified: 'pending', training: false, ratingAvg: 4.2, ratingCount: 12, lessonCount: 12, bio: '大学生。体力づくりが得意。' },
  }
  const club: Club = {
    id: clubId, name: '中野区 地域バスケットボールクラブ', sport: 'バスケットボール', areaLabel: '東京都中野区', lat: 35.7074, lon: 139.6638,
    venues: [{ name: '江原小学校 体育館', indoor: true }, { name: '富士見グラウンド', indoor: false }], fee: 3000, inviteCode: 'NAKANO', coachCode: 'COACH1', schoolCode: 'SCHOOL', schoolUids: ['demo-school'],
    ownerUid: 'demo-admin', adminUids: ['demo-admin'], coachUids: ['demo-coach'], memberUids: ['demo-admin', 'demo-member', 'demo-coach', 'demo-school'],
  }
  const names = ['加藤 結衣', '加藤 陸', '田中 陽向', '吉田 蓮', '山口 葵', '松本 湊', '井上 凛', '木村 悠真', '林 心春', '清水 大和', '森 結菜', '池田 颯']
  const players: Player[] = names.map((n, i) => ({ id: 'p' + (i + 1), name: n, grade: `中学${1 + (i % 3)}年`, guardianUids: i < 2 ? ['demo-member'] : [], discount: i === 4 ? 50 : i === 8 ? 100 : 0 }))
  const events: ClubEvent[] = []
  for (let d = -56; d <= 14; d++) {
    const day = addDays(T, d)
    const dow = day.getDay()
    if (dow !== 6 && dow !== 0) continue
    if (dow === 0 && d < 0 && Math.floor((d + 56) / 7) % 3 !== 0) continue // 日曜は3週に1回（土日のどちらかを休養日に）
    const outdoor = dow === 0 && d > 0
    const att: ClubEvent['att'] = {}
    players.forEach((p, i) => { if (d < 0) att[p.id] = r() > 0.15 ? 'yes' : 'no'; else if (d <= 7 && i > 1 && r() > 0.4) att[p.id] = r() > 0.2 ? 'yes' : 'no' })
    events.push({ id: 'e' + iso(day), title: outdoor ? '屋外練習・体力づくり' : '通常練習', date: iso(day), start: dow === 0 ? '13:00' : '09:00', minutes: 150, venue: outdoor ? '富士見グラウンド' : '江原小学校 体育館', indoor: !outdoor, coachUid: 'demo-coach', coachName: '佐藤 健太', status: 'scheduled', att })
  }
  const conds: Condition[] = []
  players.forEach((p, i) => {
    events.filter(e => e.date < iso(T) && e.att[p.id] === 'yes').forEach(e => {
      const recent = (T.getTime() - new Date(e.date).getTime()) / 864e5 <= 7
      const rpe = i === 2 && recent ? 8 : 4 + Math.round(r() * 2)
      conds.push({ id: uid6(), playerId: p.id, date: e.date, rpe, minutes: i === 2 && recent ? 210 : 150, sleep: i === 2 && recent ? 5.5 : 6.5 + Math.round(r() * 15) / 10, at: Date.now() })
    })
    if (i === 2) [2, 4].forEach(k => conds.push({ id: uid6(), playerId: p.id, date: iso(addDays(T, -k)), rpe: 7, minutes: 90, sleep: 5.5, at: Date.now() }))
  })
  const month = monthOf(T)
  const fees: Fee[] = players.map((p, i) => {
    const amount = club.fee * (100 - p.discount) / 100
    return { id: `${month}_${p.id}`, month, playerId: p.id, playerName: p.name, amount, status: amount === 0 ? 'exempt' : i === 1 || i === 6 ? 'unpaid' : 'paid', guardianUids: p.guardianUids }
  })
  const now = Date.now()
  const ann: Announcement[] = [
    { id: 'a1', text: '今月から会費はアプリでのカード払いになりました。「会費」タブからお手続きください。', kind: 'info', byName: '田中 恵', at: now - 2 * 864e5 },
    { id: 'a2', text: '日曜の屋外練習は、暑さ指数によって時間変更になることがあります。前日にアプリでお知らせします。', kind: 'info', byName: '田中 恵', at: now - 6 * 864e5 },
  ]
  const contracts: Contract[] = [
    { id: 'k1', coach: 'c4', coachName: '伊藤 さくら', player: 'demo-admin', playerName: '田中 恵', clubId, clubName: club.name, title: '土曜の指導（月2回）', fee: 6000, status: 'proposed', at: now - 864e5 },
  ]
  const msgs: Record<string, Message[]> = { k1: [{ id: 'm1', from: 'demo-admin', fromName: '田中 恵', text: 'はじめまして。土曜午前の練習をご担当いただけないでしょうか。', at: now - 864e5 }] }
  const notices: Notice[] = [
    { id: 'n1', to: 'demo-member', text: '会費のお支払いをお願いします（加藤 陸さん・今月分）', type: 'pay', read: false, at: now - 3600e3 },
    { id: 'n2', to: 'demo-coach', text: '田中 陽向さんの練習負荷が急に増えています', type: 'announce', read: false, at: now - 7200e3 },
  ]
  return {
    v: 6, auth: null, users, clubs: { [clubId]: club }, invites: { NAKANO: clubId, COACH1: clubId + '#coach', SCHOOL: clubId + '#school' },
    players: { [clubId]: players }, events: { [clubId]: events }, ann: { [clubId]: ann }, conds: { [clubId]: conds },
    fees: { [clubId]: fees }, inc: { [clubId]: [{ id: 'i1', date: iso(addDays(T, -20)), type: 'ヒヤリハット', who: '松本 湊', desc: '着地時に足首をひねりかけた。アイシングし練習は見学。', action: '保護者へ連絡済み' }] },
    contracts, msgs, notices,
  }
}

let DB_: DB
function load(): DB {
  try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d.v === 6) return d } } catch { /* noop */ }
  return seed()
}
const listeners = new Set<() => void>()
function save() { try { localStorage.setItem(KEY, JSON.stringify(DB_)) } catch { /* noop */ } listeners.forEach(f => f()) }
function watch(fn: () => void) { fn(); listeners.add(fn); return () => { listeners.delete(fn) } }
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const wait = () => new Promise(r => setTimeout(r, 120))

export function resetDemo() { DB_ = seed(); save() }
export function demoSignIn(uid: string) { DB_.auth = uid; save() }

DB_ = load()

export const demoBackend: Backend = {
  mode: 'demo',
  onAuth: cb => watch(() => cb(DB_.auth ? { uid: DB_.auth, email: 'demo@example.com', displayName: DB_.users[DB_.auth]?.name } : null)),
  signInEmail: async () => { throw new Error('デモでは「デモで試す」から立場を選んでください') },
  signUpEmail: async () => { throw new Error('デモでは「デモで試す」から立場を選んでください') },
  signInGoogle: async () => { throw new Error('デモでは「デモで試す」から立場を選んでください') },
  resetPassword: async () => {},
  signOut: async () => { DB_.auth = null; save() },

  watchProfile: (uid, cb) => watch(() => cb(DB_.users[uid] ? clone(DB_.users[uid]) : null)),
  saveProfile: async p => { await wait(); DB_.users[p.uid] = { ...(DB_.users[p.uid] || { uid: p.uid, name: '', role: 'member', clubIds: [] }), ...p } as Profile; save() },

  createClub: async c => {
    await wait()
    const id = 'club-' + uid6(), code = inviteCode(), coachCode = inviteCode(), schoolCode = inviteCode()
    DB_.clubs[id] = { ...c, id, inviteCode: code, coachCode, schoolCode, adminUids: [c.ownerUid], coachUids: [], schoolUids: [], memberUids: [c.ownerUid] }
    DB_.invites[code] = id
    DB_.invites[coachCode] = id + '#coach'
    DB_.invites[schoolCode] = id + '#school'
    Object.assign(DB_, { players: { ...DB_.players, [id]: [] }, events: { ...DB_.events, [id]: [] } })
    const u = DB_.users[c.ownerUid]; if (u && !u.clubIds.includes(id)) u.clubIds.push(id)
    save(); return id
  },
  joinClub: async (code, uid) => {
    await wait()
    const v = DB_.invites[code.trim().toUpperCase()]
    if (!v) throw new Error('招待コードが見つかりません。デモのコードは「NAKANO」（会員）、「COACH1」（指導者）、「SCHOOL」（学校）です。')
    const [id, role] = v.split('#')
    const c = DB_.clubs[id]
    if (!c.memberUids.includes(uid)) c.memberUids.push(uid)
    if (role === 'coach' && !c.coachUids.includes(uid)) c.coachUids.push(uid)
    if (role === 'school' && !(c.schoolUids ||= []).includes(uid)) c.schoolUids.push(uid)
    const u = DB_.users[uid]; if (u && !u.clubIds.includes(id)) u.clubIds.push(id)
    save(); return id
  },
  watchClub: (id, cb) => watch(() => cb(DB_.clubs[id] ? clone(DB_.clubs[id]) : null)),
  updateClub: async (id, patch) => { Object.assign(DB_.clubs[id], patch); save() },

  watchPlayers: (c, g, cb) => watch(() => cb(clone((DB_.players[c] || []).filter(p => !g || p.guardianUids.includes(g))))),
  savePlayer: async (c, p) => { const a = (DB_.players[c] ||= []); const i = a.findIndex(x => x.id === p.id); if (i >= 0) a[i] = p; else a.push(p); save() },
  removePlayer: async (c, id) => { DB_.players[c] = (DB_.players[c] || []).filter(p => p.id !== id); save() },

  watchEvents: (c, from, cb) => watch(() => cb(clone((DB_.events[c] || []).filter(e => e.date >= from).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))))),
  saveEvent: async (c, e) => { await wait(); const a = (DB_.events[c] ||= []); const i = a.findIndex(x => x.id === e.id); if (i >= 0) a[i] = e; else a.push(e); save() },
  setAttendance: async (c, eid, pid, v) => { const e = (DB_.events[c] || []).find(x => x.id === eid); if (e) { e.att[pid] = v; save() } },

  watchAnnouncements: (c, cb) => watch(() => cb(clone((DB_.ann[c] || []).sort((a, b) => b.at - a.at)))),
  postAnnouncement: async (c, a) => { await wait(); (DB_.ann[c] ||= []).push({ ...a, id: uid6() }); save() },

  watchConditions: (c, from, by, cb) => watch(() => cb(clone((DB_.conds[c] || []).filter(x => x.date >= from && (!by || x.by === by))))),
  addCondition: async (c, x) => { await wait(); (DB_.conds[c] ||= []).push({ ...x, id: uid6() }); save() },

  watchFees: (c, month, uid, isAdmin, cb) => watch(() => cb(clone((DB_.fees[c] || []).filter(f => f.month === month && (isAdmin || f.guardianUids.includes(uid)))))),
  saveFee: async (c, f) => { const a = (DB_.fees[c] ||= []); const i = a.findIndex(x => x.id === f.id); if (i >= 0) a[i] = f; else a.push(f); save() },

  watchIncidents: (c, cb) => watch(() => cb(clone((DB_.inc[c] || []).sort((a, b) => b.date.localeCompare(a.date))))),
  addIncident: async (c, i) => { await wait(); (DB_.inc[c] ||= []).push({ ...i, id: uid6() }); save() },

  listCoaches: async sport => { await wait(); return clone(Object.values(DB_.users).filter(u => u.role === 'coach' && (u.sports || []).includes(sport))) },
  watchContracts: (uid, cb) => watch(() => cb(clone(DB_.contracts.filter(k => k.coach === uid || k.player === uid).sort((a, b) => b.at - a.at)))),
  createContract: async k => { await wait(); const id = uid6(); DB_.contracts.push({ ...k, id }); save(); return id },
  setContractStatus: async (id, s) => { const k = DB_.contracts.find(x => x.id === id); if (k) { k.status = s; save() } },
  watchMessages: (id, cb) => watch(() => cb(clone(DB_.msgs[id] || []))),
  sendMessage: async (id, m) => { (DB_.msgs[id] ||= []).push({ ...m, id: uid6() }); save() },

  watchNotices: (uid, cb) => watch(() => cb(clone(DB_.notices.filter(n => n.to === uid).sort((a, b) => b.at - a.at)))),
  notify: async (to, text, type) => { DB_.notices.push({ id: uid6(), to, text, type, read: false, at: Date.now() }); save() },
  markRead: async id => { const n = DB_.notices.find(x => x.id === id); if (n) { n.read = true; save() } },
}
