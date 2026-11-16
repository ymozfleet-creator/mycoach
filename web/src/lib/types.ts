export type Role = 'member' | 'coach' | 'admin' | 'school'
export type Att = 'yes' | 'no' | 'maybe'

export interface Profile {
  uid: string
  name: string
  role: Role
  clubIds: string[]
  // 指導者プロフィール
  sports?: string[]
  areaLabel?: string
  lat?: number
  lon?: number
  days?: number[]
  license?: string
  verified?: 'none' | 'pending' | 'approved'
  training?: boolean
  teacher?: boolean
  bio?: string
  org?: string // 学校名・所属
  ratingAvg?: number
  ratingCount?: number
  lessonCount?: number
  rate?: number // 希望する1回あたりの謝金（円）
  skills?: string[] // 得意な指導（SKILLS から選択）
  ages?: string[] // 指導したい年代（AGES）
  levels?: string[] // 指導スタイル（LEVELS）
  years?: number // 指導歴（年）
  photo?: string // プロフィール写真（縮小したJPEGのdata URL。位置情報などは含まない）
  agreedAt?: number // 利用規約・プライバシーポリシーに同意した日時
  eligibleAt?: number // 18歳以上・欠格事由に該当しないことを本人が申告した日時
  licenseVerified?: boolean // 資格の証明書を事務局が確認済み（本人は変更できない）
  trainingAt?: number
  verifyNote?: string // 事務局からの差し戻し理由
  isAdmin?: boolean // 運営事務局（審査担当）。Firestoreのルール上、本人は変更できない
  stripeAccountId?: string
  stripeChargesEnabled?: boolean
}

/** クラブの指導者募集 */
export interface Post {
  id: string
  clubId: string
  clubName: string
  ownerUid: string
  ownerName: string
  sport: string
  areaLabel: string
  lat: number
  lon: number
  title: string
  days: number[]
  start: string
  fee: number
  note: string
  skills?: string[] // 求める指導内容
  ages?: string[] // 対象の年代
  level?: string // クラブの方針（LEVELS のどれか）
  photo?: string // クラブの写真（募集を出した時点のもの）
  status: 'open' | 'closed'
  at: number
}

/** 本人確認の提出書類（本人と事務局のみ閲覧可） */
export interface VerifyDoc {
  uid: string
  name: string
  docType: string
  image: string // 縮小したJPEG（data URL）
  licenseImage?: string // 指導者資格の証明（任意）
  at: number
}

export interface Payment { id: string; contractId: string; coach: string; player: string; amount: number; base: number; net: number; ts: number; released?: boolean; releaseAt?: number }
export interface Review { id: string; from: string; to: string; contractId: string; rating: number; text: string; at: number }

export interface Venue { name: string; indoor: boolean }

export interface Club {
  id: string
  name: string
  sport: string
  areaLabel: string
  lat: number
  lon: number
  venues: Venue[]
  fee: number
  inviteCode: string
  coachCode?: string
  schoolCode?: string
  schoolUids?: string[]
  ownerUid: string
  adminUids: string[]
  coachUids: string[]
  memberUids: string[]
  photo?: string // クラブの写真（ロゴ・活動場所。子どもの顔は不可）
  insurance?: { name: string; until: string } // 加入している保険（例：スポーツ安全保険・有効期限）
  dbs?: { certified: boolean; allChecked: boolean; at: number } // こども性暴力防止法の認定・確認の体制（個人の結果は含めない）
}

export interface Player {
  id: string
  name: string
  grade: string
  guardianUids: string[]
  discount: number // 0 / 50 / 100（%）
  insured?: boolean // スポーツ保険に加入済み
}

export interface ClubEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD
  start: string // HH:MM
  minutes: number
  venue: string
  indoor: boolean
  coachUid?: string
  coachName?: string
  status: 'scheduled' | 'canceled'
  note?: string
  att: Record<string, Att>
}

export interface Announcement {
  id: string
  text: string
  kind: 'info' | 'urgent'
  byName: string
  at: number
}

export interface Condition {
  id: string
  playerId: string
  date: string
  rpe: number
  minutes: number
  sleep: number
  at: number
  by?: string
}

export interface Fee {
  id: string // `${month}_${playerId}`
  month: string // YYYY-MM
  playerId: string
  playerName: string
  amount: number
  status: 'unpaid' | 'paid' | 'exempt'
  guardianUids: string[]
  paidAt?: number
}

export interface Incident {
  id: string
  date: string
  type: 'ヒヤリハット' | '事故'
  who: string
  desc: string
  action: string
}

/** 指導の依頼（既存 contracts コレクションを流用：player=依頼したクラブ運営者） */
export interface Contract {
  id: string
  coach: string
  coachName: string
  player: string
  playerName: string
  clubId: string
  clubName: string
  clubCode?: string
  message?: string
  title: string
  fee: number
  status: 'proposed' | 'active' | 'declined' | 'completed' | 'withdrawn'
  by?: string // 依頼・応募を出した人（返事ができるのは相手側だけ）
  postId?: string
  reviewed?: boolean
  at: number
}

export interface Message { id: string; from: string; fromName: string; text: string; at: number }

export interface Notice { id: string; to: string; text: string; type: string; read: boolean; at: number }

/** 会費の減免の申請（保護者 → 運営） */
export interface FeeRequest { id: string; playerId: string; playerName: string; by: string; byName: string; discount: 50 | 100; reason: string; status: 'pending' | 'approved' | 'declined'; at: number; note?: string }

/** 施設（学校の体育館・校庭など）の利用申請（運営 → 学校） */
export interface FacilityRequest { id: string; venue: string; date: string; start: string; minutes: number; purpose: string; by: string; byName: string; status: 'pending' | 'approved' | 'declined'; at: number; note?: string }

/** 指導者の犯罪事実確認（こども性暴力防止法）の「期限」の管理。結果は保存しない */
export interface StaffCheck { id: string; name: string; lastAt: string; nextDue: string }

/** 相談窓口（保護者・生徒 → 運営・事務局） */
export interface Consult { id: string; by: string; byName: string; anonymous: boolean; category: string; text: string; status: 'new' | 'done'; at: number }

/** 通報（不適切な写真・プロフィール・募集など） */
export interface Report { id: string; from: string; targetType: 'user' | 'post' | 'club'; targetId: string; targetName: string; reason: string; detail: string; status: 'new' | 'done'; at: number }

export type ClubSub = 'feeRequests' | 'facilityRequests' | 'staffChecks' | 'consults'
