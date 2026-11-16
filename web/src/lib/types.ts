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
  status: 'open' | 'closed'
  at: number
}

/** 本人確認の提出書類（本人と事務局のみ閲覧可） */
export interface VerifyDoc {
  uid: string
  name: string
  docType: string
  image: string // 縮小したJPEG（data URL）
  at: number
}

export interface Payment { id: string; contractId: string; coach: string; player: string; amount: number; base: number; net: number; ts: number }
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
}

export interface Player {
  id: string
  name: string
  grade: string
  guardianUids: string[]
  discount: number // 0 / 50 / 100（%）
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
