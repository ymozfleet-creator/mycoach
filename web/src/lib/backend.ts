import type { Announcement, Att, Club, ClubEvent, Condition, Contract, Fee, Incident, Message, Notice, Player, Profile } from './types'

export type Unsub = () => void
export type Cb<T> = (v: T) => void

/** 本番（Firestore）とデモ（ブラウザ内保存）で共通のデータ操作 */
export interface Backend {
  mode: 'firebase' | 'demo'
  onAuth(cb: Cb<{ uid: string; email?: string | null; displayName?: string | null } | null>): Unsub
  signInEmail(email: string, pass: string): Promise<void>
  signUpEmail(email: string, pass: string): Promise<void>
  signInGoogle(): Promise<void>
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>

  watchProfile(uid: string, cb: Cb<Profile | null>): Unsub
  saveProfile(p: Partial<Profile> & { uid: string }): Promise<void>

  createClub(c: Omit<Club, 'id' | 'inviteCode' | 'coachCode' | 'adminUids' | 'coachUids' | 'memberUids'>): Promise<string>
  /** 招待コードで参加。会員用コードなら会員、指導者用コードなら指導者として参加する */
  joinClub(code: string, uid: string): Promise<string>
  watchClub(id: string, cb: Cb<Club | null>): Unsub
  updateClub(id: string, patch: Partial<Club>): Promise<void>

  /** onlyGuardian を渡すと、その保護者にひも付く会員だけを取得（保護者は他家庭の情報を読めない） */
  watchPlayers(clubId: string, onlyGuardian: string | null, cb: Cb<Player[]>): Unsub
  savePlayer(clubId: string, p: Player): Promise<void>
  removePlayer(clubId: string, id: string): Promise<void>

  watchEvents(clubId: string, from: string, cb: Cb<ClubEvent[]>): Unsub
  saveEvent(clubId: string, e: ClubEvent): Promise<void>
  setAttendance(clubId: string, eventId: string, playerId: string, a: Att): Promise<void>

  watchAnnouncements(clubId: string, cb: Cb<Announcement[]>): Unsub
  postAnnouncement(clubId: string, a: Omit<Announcement, 'id'>): Promise<void>

  watchConditions(clubId: string, from: string, onlyBy: string | null, cb: Cb<Condition[]>): Unsub
  addCondition(clubId: string, c: Omit<Condition, 'id'>): Promise<void>

  watchFees(clubId: string, month: string, uid: string, isAdmin: boolean, cb: Cb<Fee[]>): Unsub
  saveFee(clubId: string, f: Fee): Promise<void>

  watchIncidents(clubId: string, cb: Cb<Incident[]>): Unsub
  addIncident(clubId: string, i: Omit<Incident, 'id'>): Promise<void>

  listCoaches(sport: string): Promise<Profile[]>
  watchContracts(uid: string, cb: Cb<Contract[]>): Unsub
  createContract(c: Omit<Contract, 'id'>): Promise<string>
  setContractStatus(id: string, s: Contract['status']): Promise<void>
  watchMessages(contractId: string, cb: Cb<Message[]>): Unsub
  sendMessage(contractId: string, m: Omit<Message, 'id'>): Promise<void>

  watchNotices(uid: string, cb: Cb<Notice[]>): Unsub
  notify(to: string, text: string, type: string): Promise<void>
  markRead(id: string): Promise<void>
}
