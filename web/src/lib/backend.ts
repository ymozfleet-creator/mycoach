import type { Announcement, Att, Club, ClubEvent, Condition, Contract, Fee, Incident, Message, Notice, Payment, Player, Post, Profile, Report, Review, VerifyDoc, ClubSub, AttNote } from './types'

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

  createClub(c: Omit<Club, 'id' | 'inviteCode' | 'coachCode' | 'schoolCode' | 'schoolUids' | 'adminUids' | 'coachUids' | 'memberUids'>): Promise<string>
  /** 招待コードで参加。会員用・指導者用・学校用のコードで、それぞれの立場として参加する */
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
  /** 運営者がクラブに指導者を加える（応募の採用時） */
  addCoach(clubId: string, uid: string): Promise<void>
  /** その指導者専用の招待コードを発行（依頼を引き受けたときの参加用） */
  createCoachInvite(clubId: string): Promise<string>

  watchOpenPosts(cb: Cb<Post[]>): Unsub
  watchClubPosts(clubId: string, cb: Cb<Post[]>): Unsub
  savePost(p: Post): Promise<void>

  submitVerification(d: VerifyDoc): Promise<void>
  getVerifyDoc(uid: string): Promise<VerifyDoc | null>
  watchPendingVerifications(cb: Cb<Profile[]>): Unsub
  decideVerification(uid: string, ok: boolean, note: string, licenseOk?: boolean): Promise<void>

  watchPayments(uid: string, cb: Cb<Payment[]>): Unsub
  watchClubPayments(clubId: string, cb: Cb<Payment[]>): Unsub
  /** 謝金のカード払い（デモでは即時に支払い済みにする） */
  payContract(contractId: string, returnUrl: string): Promise<string | null>
  /** 指導者の受取口座（Stripe）の設定ページURL */
  connectPayout(returnUrl: string): Promise<string | null>
  addReview(r: Omit<Review, 'id'>): Promise<void>
  /** 預かっている謝金を指導者へ送金する（指導の実施を確認したあと） */
  releasePayment(paymentId: string): Promise<void>

  /** クラブ内の申請・記録（減免申請・施設の利用申請・確認期限・相談） */
  watchSub<T>(clubId: string, name: ClubSub, cb: Cb<T[]>, onlyBy?: string): Unsub
  addSub(clubId: string, name: ClubSub, data: object, id?: string): Promise<void>
  updateSub(clubId: string, name: ClubSub, id: string, patch: object): Promise<void>

  /** 欠席の理由：保護者が入力、運営・指導者が閲覧（onlyBy は保護者自身の分） */
  setAttNote(clubId: string, eventId: string, playerId: string, note: string): Promise<void>
  watchAttNotes(clubId: string, eventId: string, cb: Cb<AttNote[]>, onlyBy?: string): Unsub
  addReport(r: Omit<Report, 'id'>): Promise<void>
  watchReports(cb: Cb<Report[]>): Unsub
  resolveReport(id: string): Promise<void>
  /** 事務局が不適切な写真・募集を非表示にする */
  moderate(targetType: Report['targetType'], targetId: string): Promise<void>
  watchContracts(uid: string, cb: Cb<Contract[]>): Unsub
  createContract(c: Omit<Contract, 'id'>): Promise<string>
  setContractStatus(id: string, s: Contract['status']): Promise<void>
  watchMessages(contractId: string, cb: Cb<Message[]>): Unsub
  sendMessage(contractId: string, m: Omit<Message, 'id'>): Promise<void>

  watchNotices(uid: string, cb: Cb<Notice[]>): Unsub
  notify(to: string, text: string, type: string): Promise<void>
  markRead(id: string): Promise<void>
}
