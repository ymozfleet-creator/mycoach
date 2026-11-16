import type { Backend } from './backend'
import type { Announcement, Club, ClubEvent, Condition, Contract, Fee, Incident, Message, Notice, Payment, Player, Post, Profile, Report, Review, VerifyDoc } from './types'
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
  posts: Post[]
  subs: Record<string, any[]>
  reports: Report[]
  verify: Record<string, VerifyDoc>
  payments: Payment[]
  reviews: Review[]
}
const KEY = 'mcmt_demo_v13'
export const DEMO_USERS = { admin: 'demo-admin', coach: 'demo-coach', member: 'demo-member', school: 'demo-school', free: 'demo-free' } as const

function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 } }


/* デモ用のイラスト（実在の人物の写真は使わない） */
const svgUrl = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
function personArt(bg: string, skin: string, hair: string, shirt: string, long = false) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/>` +
    (long ? `<path d="M30 62c0-26 12-40 30-40s30 14 30 40v34H30z" fill="${hair}"/>` : '') +
    `<path d="M18 120c4-24 20-34 42-34s38 10 42 34z" fill="${shirt}"/><rect x="52" y="70" width="16" height="18" rx="6" fill="${skin}"/>` +
    `<circle cx="60" cy="54" r="22" fill="${skin}"/><path d="M37 52c0-16 10-26 23-26s23 10 23 26c-6-8-14-12-23-12s-17 4-23 12z" fill="${hair}"/>` +
    `<circle cx="52" cy="56" r="2.4" fill="#2b2b2b"/><circle cx="68" cy="56" r="2.4" fill="#2b2b2b"/><path d="M53 65q7 5 14 0" stroke="#b55" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`)
}
function courtArt(c1: string, c2: string) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#g)"/><rect x="20" y="30" width="280" height="130" rx="6" fill="#d9a066"/><g fill="none" stroke="#fff" stroke-width="3"><rect x="20" y="30" width="280" height="130" rx="6"/><line x1="160" y1="30" x2="160" y2="160"/><circle cx="160" cy="95" r="22"/><path d="M20 62h50v66H20M300 62h-50v66h50"/></g>` +
    `<circle cx="226" cy="58" r="16" fill="#f07a2a"/><path d="M210 58h32M226 42v32M215 47q11 11 0 22M237 47q-11 11 0 22" stroke="#7a3a10" stroke-width="2" fill="none"/></svg>`)
}

function seed(): DB {
  const r = rng(7)
  const T = today()
  const clubId = 'club-nakano'
  const users: Record<string, Profile> = {
    'demo-admin': { uid: 'demo-admin', name: '田中 恵', role: 'admin', clubIds: [clubId], isAdmin: true },
    'demo-member': { uid: 'demo-member', name: '加藤 由美', role: 'member', clubIds: [clubId] },
    'demo-school': { uid: 'demo-school', name: '高橋 誠', role: 'school', clubIds: [clubId], org: '中野区立第五中学校' },
    'demo-coach': { uid: 'demo-coach', licenseVerified: true, eligibleAt: Date.now() - 90 * 864e5, name: '佐藤 健太', role: 'coach', photo: personArt('#DBEAFE', '#F2C9A5', '#2B2B2B', '#2563EB'), skills: ['基礎・ドリル', 'ディフェンス・守備', '初心者の指導'], ages: ['中学生'], levels: ['楽しむ・初心者中心'], years: 8, clubIds: [clubId], sports: ['バスケットボール'], areaLabel: '中野区', lat: 35.715, lon: 139.65, days: [6, 0, 3], license: 'JSPO公認コーチ1', verified: 'approved', training: true, ratingAvg: 4.8, ratingCount: 126, lessonCount: 126, bio: '元実業団。基礎とディフェンスの指導が得意です。', rate: 6000, trainingAt: Date.now() - 90 * 864e5 },
    'demo-free': { uid: 'demo-free', name: '小林 拓也', role: 'coach', skills: ['基礎・ドリル', '体力づくり'], ages: ['小学生', '中学生'], levels: ['楽しむ・初心者中心'], years: 5, clubIds: [], sports: ['バスケットボール'], areaLabel: '東京都中野区', lat: 35.708, lon: 139.666, days: [6, 0], license: '', verified: 'none', training: false, bio: '', rate: 5000 },
    'c2': { uid: 'c2', name: '山田 美咲', role: 'coach', photo: personArt('#FCE7F3', '#F5D0B5', '#4B2E1E', '#DB2777', true), skills: ['シュート・打撃', '戦術・試合運び'], ages: ['中学生', '高校生'], levels: ['大会で勝つことをめざす'], years: 6, clubIds: [], sports: ['バスケットボール'], areaLabel: '新宿区', lat: 35.69, lon: 139.7, days: [6], license: '元実業団選手', verified: 'approved', training: true, ratingAvg: 4.9, ratingCount: 88, lessonCount: 88, bio: 'シュート指導が専門です。' },
    'c3': { uid: 'c3', name: '鈴木 大輔', role: 'coach', photo: personArt('#DCFCE7', '#E8B98F', '#1F1F1F', '#059669'), skills: ['基礎・ドリル', '体力づくり'], ages: ['中学生'], levels: ['楽しむ・初心者中心'], years: 4, clubIds: [], sports: ['バスケットボール'], areaLabel: '中野区', lat: 35.712, lon: 139.655, days: [6, 0], license: 'JSPO公認スタートコーチ', verified: 'approved', training: false, teacher: true, ratingAvg: 4.5, ratingCount: 40, lessonCount: 40, bio: '中学校教員（兼職兼業の許可済み）。' },
    'c4': { uid: 'c4', name: '伊藤 さくら', role: 'coach', photo: personArt('#FEF3C7', '#F6D3B3', '#5B3A1E', '#D97706', true), skills: ['基礎・ドリル', '初心者の指導', 'ケガ予防・コンディショニング'], ages: ['小学生', '中学生'], levels: ['楽しむ・初心者中心'], years: 12, clubIds: [], sports: ['バスケットボール'], areaLabel: '杉並区', lat: 35.705, lon: 139.68, days: [6, 0, 5], license: 'JSPO公認コーチ3', verified: 'approved', training: true, ratingAvg: 4.7, ratingCount: 210, lessonCount: 210, bio: '小中学生の育成年代を15年指導。' },
    'c6': { uid: 'c6', name: '中島 大和', role: 'coach', photo: personArt('#E0E7FF', '#EBC19B', '#262626', '#4F46E5'), skills: ['基礎・ドリル', '初心者の指導'], ages: ['中学生'], levels: ['楽しむ・初心者中心'], years: 5, clubIds: [], sports: ['バスケットボール'], areaLabel: '中野区', lat: 35.71, lon: 139.67, days: [6, 0], license: 'JSPO公認スタートコーチ', verified: 'approved', training: true, ratingAvg: 4.8, ratingCount: 31, lessonCount: 31, rate: 6000, bio: '中学校で外部指導員を5年。基礎のドリルと、声をかけ合うチームづくりを大切にしています。' },
    'c7': { uid: 'c7', name: '小川 葵', role: 'coach', photo: personArt('#FFE4E6', '#F4CDB0', '#3A2416', '#E11D48', true), skills: ['戦術・試合運び', 'シュート・打撃'], ages: ['中学生', '高校生'], levels: ['大会で勝つことをめざす'], years: 7, clubIds: [], sports: ['バスケットボール'], areaLabel: '豊島区', lat: 35.726, lon: 139.716, days: [6, 3], license: '元WJBLプレーヤー', verified: 'approved', training: true, ratingAvg: 4.9, ratingCount: 54, lessonCount: 54, rate: 7000, bio: 'ポイントガード出身。パスとゲームの組み立て方を、中高生にもわかる言葉で教えます。' },
    'c8': { uid: 'c8', name: '森田 健', role: 'coach', photo: personArt('#E2E8F0', '#DDAF86', '#3F3F46', '#0F2A4A'), skills: ['体力づくり', 'ケガ予防・コンディショニング'], ages: ['中学生'], levels: ['楽しむ・初心者中心', '大会で勝つことをめざす'], years: 10, clubIds: [], sports: ['バスケットボール'], areaLabel: '渋谷区', lat: 35.664, lon: 139.698, days: [0], license: '中学校教諭（保健体育）', verified: 'approved', training: true, teacher: true, ratingAvg: 4.6, ratingCount: 18, lessonCount: 18, rate: 5000, bio: '現職の教員です（兼職兼業の許可あり）。体づくりとケガの予防を中心に指導します。' },
    'c5': { uid: 'c5', name: '高橋 翔', role: 'coach', clubIds: [], sports: ['バスケットボール'], areaLabel: '練馬区', lat: 35.76, lon: 139.6, days: [0, 2], license: '', verified: 'pending', training: false, ratingAvg: 4.2, ratingCount: 12, lessonCount: 12, bio: '大学生。体力づくりが得意。' },
    'club-suginami-admin': { uid: 'club-suginami-admin', name: '森 由紀', role: 'admin', clubIds: [] },
    'club-nerima-admin': { uid: 'club-nerima-admin', name: '石井 亮', role: 'admin', clubIds: [] },
  }
  const club: Club = {
    id: clubId, name: '中野区 地域バスケットボールクラブ', sport: 'バスケットボール', areaLabel: '東京都中野区', lat: 35.7074, lon: 139.6638,
    venues: [{ name: '江原小学校 体育館', indoor: true }, { name: '富士見グラウンド', indoor: false }], fee: 3000, photo: courtArt('#0F2A4A', '#2563EB'), insurance: { name: 'スポーツ安全保険', until: '2027-03-31' }, inviteCode: 'NAKANO', coachCode: 'COACH1', schoolCode: 'SCHOOL', schoolUids: ['demo-school'],
    ownerUid: 'demo-admin', adminUids: ['demo-admin'], coachUids: ['demo-coach'], memberUids: ['demo-admin', 'demo-member', 'demo-coach', 'demo-school'],
  }
  const names = ['加藤 結衣', '加藤 陸', '田中 陽向', '吉田 蓮', '山口 葵', '松本 湊', '井上 凛', '木村 悠真', '林 心春', '清水 大和', '森 結菜', '池田 颯']
  const players: Player[] = names.map((n, i) => ({ id: 'p' + (i + 1), name: n, grade: `中学${1 + (i % 3)}年`, guardianUids: i < 2 ? ['demo-member'] : [], discount: i === 4 ? 50 : i === 8 ? 100 : 0, insured: i !== 6 && i !== 10 }))
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
    { id: 'k1', coach: 'c4', coachName: '伊藤 さくら', player: 'demo-admin', playerName: '田中 恵', clubId, clubName: club.name, title: '土曜の指導（月2回）', fee: 6000, status: 'proposed', by: 'demo-admin', at: now - 864e5 },
    { id: 'k2', coach: 'demo-coach', coachName: '佐藤 健太', player: 'demo-admin', playerName: '田中 恵', clubId, clubName: club.name, title: '土日の練習指導', fee: 6000, status: 'active', by: 'demo-admin', at: now - 60 * 864e5 },
    { id: 'k3', coach: 'c6', coachName: '中島 大和', player: 'demo-admin', playerName: '田中 恵', clubId, clubName: club.name, title: '土曜午前の練習を担当できる方', fee: 6000, message: '中学校で外部指導員を5年務めています。土曜午前、ぜひ担当させてください。', status: 'proposed', by: 'c6', postId: 'post1', at: now - 3 * 3600e3 },
    { id: 'k4', coach: 'demo-coach', coachName: '佐藤 健太', player: 'club-nerima-admin', playerName: '石井 亮', clubId: 'club-nerima', clubName: '練馬区 地域バスケットボールクラブ', clubCode: 'NERIMA01', title: '水曜夕方の体力づくり担当', fee: 5000, message: 'プロフィールを拝見しました。水曜夕方の体力づくりをお願いできませんか。', status: 'proposed', by: 'club-nerima-admin', postId: 'post3', at: now - 5 * 3600e3 },
  ]
  const msgs: Record<string, Message[]> = { k1: [{ id: 'm1', from: 'demo-admin', fromName: '田中 恵', text: 'はじめまして。土曜午前の練習をご担当いただけないでしょうか。', at: now - 864e5 }], k3: [{ id: 'm3', from: 'c6', fromName: '中島 大和', text: '中学校で外部指導員を5年務めています。土曜午前、ぜひ担当させてください。', at: now - 3 * 3600e3 }], k4: [{ id: 'm4', from: 'club-nerima-admin', fromName: '石井 亮', text: 'プロフィールを拝見しました。水曜夕方の体力づくりをお願いできませんか。', at: now - 5 * 3600e3 }] }
  const notices: Notice[] = [
    { id: 'n1', to: 'demo-member', text: '会費のお支払いをお願いします（加藤 陸さん・今月分）', type: 'pay', read: false, at: now - 3600e3 },
    { id: 'n2', to: 'demo-coach', text: '田中 陽向さんの練習負荷が急に増えています', type: 'announce', read: false, at: now - 7200e3 },
  ]
  return {
    v: 13, auth: null, users,
    clubs: {
      [clubId]: club,
      // 他地域のクラブ（募集・依頼のデモ用）
      'club-nerima': { id: 'club-nerima', name: '練馬区 地域バスケットボールクラブ', sport: 'バスケットボール', areaLabel: '東京都練馬区', lat: 35.7356, lon: 139.6517, venues: [{ name: '練馬区立体育館', indoor: true }], fee: 2500, inviteCode: 'NERIMA', coachCode: 'NERIMAC', ownerUid: 'club-nerima-admin', adminUids: ['club-nerima-admin'], coachUids: [], memberUids: ['club-nerima-admin'] },
      'club-suginami': { id: 'club-suginami', name: '杉並区 地域バスケットボールクラブ', sport: 'バスケットボール', areaLabel: '東京都杉並区', lat: 35.6995, lon: 139.6364, venues: [{ name: '杉並区立体育館', indoor: true }], fee: 3000, inviteCode: 'SUGINA', coachCode: 'SUGINAC', ownerUid: 'club-suginami-admin', adminUids: ['club-suginami-admin'], coachUids: [], memberUids: ['club-suginami-admin'] },
    },
    invites: { NAKANO: clubId, COACH1: clubId + '#coach', SCHOOL: clubId + '#school', NERIMA01: 'club-nerima#coach' },
    players: { [clubId]: players }, events: { [clubId]: events }, ann: { [clubId]: ann }, conds: { [clubId]: conds },
    fees: { [clubId]: fees }, inc: { [clubId]: [{ id: 'i1', date: iso(addDays(T, -20)), type: 'ヒヤリハット', who: '松本 湊', desc: '着地時に足首をひねりかけた。アイシングし練習は見学。', action: '保護者へ連絡済み' }] },
    contracts, msgs, notices,
    posts: [
      { id: 'post1', photo: courtArt('#0F2A4A', '#2563EB'), clubId, clubName: club.name, ownerUid: 'demo-admin', ownerName: '田中 恵', sport: 'バスケットボール', areaLabel: '東京都中野区', lat: club.lat, lon: club.lon, title: '土曜午前の練習を担当できる方', days: [6], start: '09:00', fee: 6000, note: '中学生12人。基礎練習と試合形式の指導をお願いします。', skills: ['基礎・ドリル', '戦術・試合運び'], ages: ['中学生'], level: '楽しむ・初心者中心', status: 'open', at: now - 2 * 864e5 },
      { id: 'post2', photo: courtArt('#065F46', '#10B981'), clubId: 'club-suginami', clubName: '杉並区 地域バスケットボールクラブ', ownerUid: 'club-suginami-admin', ownerName: '森 由紀', sport: 'バスケットボール', areaLabel: '東京都杉並区', lat: 35.6995, lon: 139.6364, title: '日曜午後の指導者（月2回〜）', days: [0], start: '13:00', fee: 7000, note: '小学5年〜中学2年。初心者が多いクラブです。', skills: ['初心者の指導', '基礎・ドリル'], ages: ['小学生', '中学生'], level: '楽しむ・初心者中心', status: 'open', at: now - 864e5 },
      { id: 'post3', photo: courtArt('#7C2D12', '#F97316'), clubId: 'club-nerima', clubName: '練馬区 地域バスケットボールクラブ', ownerUid: 'club-nerima-admin', ownerName: '石井 亮', sport: 'バスケットボール', areaLabel: '東京都練馬区', lat: 35.7356, lon: 139.6517, title: '水曜夕方の体力づくり担当', days: [3], start: '17:00', fee: 5000, note: '平日の短時間（90分）です。', skills: ['体力づくり', 'ケガ予防・コンディショニング'], ages: ['中学生'], status: 'open', at: now - 5 * 864e5 },
    ],
    verify: { c5: { uid: 'c5', name: '高橋 翔', docType: '運転免許証', image: '', at: now - 3600e3 } },
    payments: [
      { id: 'pay1', contractId: 'k2', coach: 'demo-coach', player: 'demo-admin', clubId, amount: 6600, base: 6000, net: 4800, ts: now - 21 * 864e5, released: true },
      { id: 'pay2', contractId: 'k2', coach: 'demo-coach', player: 'demo-admin', clubId, amount: 6600, base: 6000, net: 4800, ts: now - 2 * 864e5, released: false, releaseAt: now + 5 * 864e5 },
    ] as any, reviews: [],
    subs: {
      [clubId + '/feeRequests']: [{ id: 'fr1', playerId: 'p2', playerName: '加藤 陸', by: 'demo-member', byName: '加藤 由美', discount: 50, reason: 'きょうだい2人が在籍しているため', status: 'pending', at: now - 864e5 }],
      [clubId + '/facilityRequests']: [{ id: 'fa1', venue: '江原小学校 体育館', date: iso(addDays(today(), 12)), start: '09:00', minutes: 150, purpose: '通常練習（中学生12人）', by: 'demo-admin', byName: '田中 恵', status: 'pending', at: now - 2 * 864e5 }],
      [clubId + '/staffChecks']: [{ id: 'demo-coach', name: '佐藤 健太', lastAt: '2026-04-01', nextDue: '2031-04-01' }],
      [clubId + '/consults']: [],
    },
    reports: [{ id: 'rp1', from: 'demo-member', targetType: 'user', targetId: 'c3', targetName: '鈴木 大輔', reason: 'プロフィールの写真が不適切', detail: '本人以外の人が写っているようです', status: 'new', at: now - 3600e3 }],
  }
}

let DB_: DB
function load(): DB {
  try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d.v === 13) return d } } catch { /* noop */ }
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

  watchConditions: (c, from, by, cb) => watch(() => cb(clone((DB_.conds[c] || []).filter(x => x.date >= from && (!by || x.by === by || ((DB_.players[c] || []).find(p => p.id === x.playerId)?.guardianUids || []).includes(by)))))),
  addCondition: async (c, x) => { await wait(); (DB_.conds[c] ||= []).push({ ...x, id: uid6() }); save() },

  watchFees: (c, month, uid, isAdmin, cb) => watch(() => cb(clone((DB_.fees[c] || []).filter(f => f.month === month && (isAdmin || f.guardianUids.includes(uid)))))),
  saveFee: async (c, f) => { const a = (DB_.fees[c] ||= []); const i = a.findIndex(x => x.id === f.id); if (i >= 0) a[i] = f; else a.push(f); save() },

  watchIncidents: (c, cb) => watch(() => cb(clone((DB_.inc[c] || []).sort((a, b) => b.date.localeCompare(a.date))))),
  addIncident: async (c, i) => { await wait(); (DB_.inc[c] ||= []).push({ ...i, id: uid6() }); save() },

  addCoach: async (clubId, uid) => {
    const c = DB_.clubs[clubId]; if (!c) return
    if (!c.coachUids.includes(uid)) c.coachUids.push(uid)
    if (!c.memberUids.includes(uid)) c.memberUids.push(uid)
    save()
  },
  createCoachInvite: async clubId => { const code = inviteCode() + inviteCode(); DB_.invites[code] = clubId + '#coach'; save(); return code },

  watchOpenPosts: cb => watch(() => cb(clone(DB_.posts.filter(p => p.status === 'open').sort((a, b) => b.at - a.at)))),
  watchClubPosts: (clubId, cb) => watch(() => cb(clone(DB_.posts.filter(p => p.clubId === clubId).sort((a, b) => b.at - a.at)))),
  savePost: async p => { await wait(); const i = DB_.posts.findIndex(x => x.id === p.id); if (i >= 0) DB_.posts[i] = p; else DB_.posts.push(p); save() },

  submitVerification: async d => { await wait(); DB_.verify[d.uid] = d; const u = DB_.users[d.uid]; if (u) { u.verified = 'pending'; u.verifyNote = '' } save() },
  getVerifyDoc: async uid => clone(DB_.verify[uid] || null),
  watchPendingVerifications: cb => watch(() => cb(clone(Object.values(DB_.users).filter(u => u.verified === 'pending')))),
  decideVerification: async (uid, ok, note, licenseOk) => {
    await wait(); const u = DB_.users[uid]; if (!u) return
    u.verified = ok ? 'approved' : 'none'; u.verifyNote = ok ? '' : note; u.licenseVerified = !!(ok && licenseOk)
    DB_.notices.push({ id: uid6(), to: uid, type: 'verify', read: false, at: Date.now(), text: ok ? '本人確認が完了しました。クラブへの応募・依頼の受付ができます' : `本人確認の書類を再提出してください：${note}` })
    save()
  },

  watchClubPayments: (c, cb) => watch(() => cb(clone(DB_.payments.filter(p => (p as any).clubId === c || DB_.contracts.some(k => k.id === p.contractId && (k as any).clubId === c)).sort((a, b) => b.ts - a.ts)))),
  watchPayments: (uid, cb) => watch(() => cb(clone(DB_.payments.filter(p => p.coach === uid || p.player === uid).sort((a, b) => b.ts - a.ts)))),
  payContract: async contractId => {
    await wait(); const k = DB_.contracts.find(x => x.id === contractId); if (!k) return null
    const base = k.fee, amount = base + Math.round(base * 0.1), net = base - Math.round(base * 0.2)
    DB_.payments.push({ id: uid6(), contractId, coach: k.coach, player: k.player, amount, base, net, ts: Date.now(), released: false, releaseAt: Date.now() + 7 * 864e5 })
    DB_.notices.push({ id: uid6(), to: k.coach, type: 'pay', read: false, at: Date.now(), text: `謝金のお支払いがありました。指導の実施が確認されると送金されます（受取額 ¥${net.toLocaleString()}）` })
    save(); return null
  },
  connectPayout: async () => { await wait(); const u = DB_.auth ? DB_.users[DB_.auth] : null; if (u) { u.stripeAccountId = 'acct_demo'; u.stripeChargesEnabled = true; save() } return null },
  addReview: async r => {
    await wait(); DB_.reviews.push({ ...r, id: uid6() })
    const list = DB_.reviews.filter(x => x.to === r.to), u = DB_.users[r.to]
    if (u) { const n = (u.ratingCount || 0) + 1; u.ratingAvg = Math.round((((u.ratingAvg || 0) * (u.ratingCount || 0)) + r.rating) / n * 10) / 10; u.ratingCount = n }
    void list; const k = DB_.contracts.find(x => x.id === r.contractId); if (k) k.reviewed = true
    save()
  },
  releasePayment: async id => { await wait(); const p = DB_.payments.find(x => x.id === id); if (p) { p.released = true; save() } },
  watchSub: (c, name, cb, onlyBy) => watch(() => cb(clone((DB_.subs[c + '/' + name] || []).filter(x => !onlyBy || x.by === onlyBy).sort((a, b) => (b.at || 0) - (a.at || 0))))),
  addSub: async (c, name, data, id) => { await wait(); const k = c + '/' + name; const arr = (DB_.subs[k] ||= []); const nid = id || uid6(); const i = arr.findIndex(x => x.id === nid); if (i >= 0) arr[i] = { ...data, id: nid }; else arr.push({ ...data, id: nid }); save() },
  updateSub: async (c, name, id, patch) => { await wait(); const x = (DB_.subs[c + '/' + name] || []).find(y => y.id === id); if (x) Object.assign(x, patch); save() },
  setAttNote: async (c, eid, pid, note) => { const k = c + '/attNotes'; const arr = (DB_.subs[k] ||= []); const id = `${eid}_${pid}`; const i = arr.findIndex(x => x.id === id); const v = { id, eventId: eid, playerId: pid, note: note.slice(0, 60), by: DB_.auth || '', at: Date.now() }; if (i >= 0) arr[i] = v; else arr.push(v); save() },
  watchAttNotes: (c, eid, cb, onlyBy) => watch(() => cb(clone((DB_.subs[c + '/attNotes'] || []).filter(x => x.eventId === eid && (!onlyBy || x.by === onlyBy))))),
  addReport: async r => { await wait(); DB_.reports.push({ ...r, id: uid6() }); save() },
  watchReports: cb => watch(() => cb(clone(DB_.reports.filter(r => r.status === 'new').sort((a, b) => b.at - a.at)))),
  resolveReport: async id => { const r = DB_.reports.find(x => x.id === id); if (r) { r.status = 'done'; save() } },
  moderate: async (type, id) => {
    await wait()
    if (type === 'user' && DB_.users[id]) DB_.users[id].photo = ''
    if (type === 'club' && DB_.clubs[id]) DB_.clubs[id].photo = ''
    if (type === 'post') { const p = DB_.posts.find(x => x.id === id); if (p) { p.photo = ''; p.status = 'closed' } }
    save()
  },
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
