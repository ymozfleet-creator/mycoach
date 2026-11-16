import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BadgeCheck, CalendarDays, Check, ChevronDown, GraduationCap, Handshake, Heart, MapPin, Megaphone, MessageCircle, PartyPopper, Search, SlidersHorizontal, Sparkles, Star, TriangleAlert, Wallet } from 'lucide-react'
import { useApp } from '../lib/store'
import { ReportButton } from '../components/ReportButton'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Ring, Segmented, Sheet, Skeleton, cx, stagger } from '../components/ui'
import { SwipeDeck } from '../components/SwipeDeck'
import { CoachSetup, coachReady } from '../components/CoachSetup'
import type { Contract, Post, Profile } from '../lib/types'
import { DOW, km, matchFit, parseDate, relTime, yen, type MatchResult } from '../lib/util'
import { SKILLS } from '../lib/places'
import { safePhoto } from '../lib/image'
import { contractBadge, initiator } from './Requests'

/* ---------- 見送った候補の記憶（この端末・この人だけ。見た目の好みなので端末内に保存） ---------- */
function usePassed(uid?: string) {
  const key = `mcmt_pass_${uid || ''}`
  const [ids, setIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] } })
  const save = (v: string[]) => { setIds(v); try { localStorage.setItem(key, JSON.stringify(v.slice(-300))) } catch { /* 保存できない環境でも動かす */ } }
  return { ids, add: (id: string) => save([...ids, id]), remove: (id: string) => save(ids.filter(x => x !== id)), clear: () => save([]) }
}

/* ---------- マッチングのしくみ（初回は開いた状態） ---------- */
function HowItWorks({ coach }: { coach: boolean }) {
  const key = 'mcmt_howto_seen'
  const [open, setOpen] = useState(false)
  const toggle = () => { setOpen(!open); try { localStorage.setItem(key, '1') } catch { /* noop */ } }
  void key
  const steps = coach
    ? [['右にスワイプ', 'いいと思った募集に、そのまま応募できます'], ['クラブも「いいね」で成立', 'クラブから依頼が届いている場合は、その場でマッチング成立'], ['成立したら指導スタート', '予定や選手の状況がアプリで見られ、謝金もアプリで受け取れます']]
    : [['右にスワイプ', '本人確認と安全研修を終えた指導者に、そのまま依頼を送れます'], ['指導者も「いいね」で成立', 'あなたのクラブに応募している指導者なら、その場でマッチング成立'], ['成立したらクラブの指導者に', '予定・出欠・選手の状況を共有。謝金はアプリからカードで支払えます']]
  return (
    <Card className="!p-0 overflow-hidden">
      <button onClick={toggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Sparkles size={18} className="text-brand" /><span className="flex-1 text-[14px] font-bold">マッチングのしくみ</span>
        <ChevronDown size={18} className={cx('text-ink-3 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-2 px-4 pb-4">
          {steps.map(([t, d], i) => (
            <div key={t} style={stagger(i)} className="flex animate-up items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-black text-white">{i + 1}</span>
              <span><b className="block text-[14px]">{t}</b><span className="text-[12px] text-ink-2">{d}</span></span>
            </div>
          ))}
          <div className="mt-1 rounded-xl bg-canvas p-3 text-[12px] leading-relaxed text-ink-2">
            <b className="text-ink">相性（100点）の決め方</b><br />
            距離 25点・曜日 25点・得意分野 20点・年代 10点・方針 5点・指導歴 5点・審査 5点・評価 5点。登録外の種目は大きく下がります。カードには「合う点」と「気をつける点」を表示します。
          </div>
        </div>
      )}
    </Card>
  )
}

/* ---------- マッチング成立の演出 ---------- */
function MatchModal({ a, b, aPhoto, bPhoto, sub, onChat, onClose }: { a: string; b: string; aPhoto?: string; bPhoto?: string; sub: string; onChat: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-navy/90 p-6 backdrop-blur-sm animate-fade" onClick={onClose}>
      <div className="w-full max-w-sm text-center text-white" onClick={e => e.stopPropagation()}>
        <PartyPopper size={44} className="mx-auto text-lime animate-pop" />
        <div className="mt-3 text-[30px] font-black tracking-wide animate-up">マッチング成立！</div>
        <p className="mt-1 text-[14px] opacity-80 animate-up" style={stagger(1)}>{sub}</p>
        <div className="my-8 flex items-center justify-center">
          <div className="animate-[slideL_.5s_cubic-bezier(.2,.8,.2,1)_both] rounded-full ring-4 ring-white"><Avatar name={a} size={84} photo={aPhoto} /></div>
          <Heart size={34} className="z-10 -mx-3 fill-lime text-lime animate-pop" />
          <div className="animate-[slideR_.5s_cubic-bezier(.2,.8,.2,1)_both] rounded-full ring-4 ring-white"><Avatar name={b} size={84} photo={bPhoto} /></div>
        </div>
        <Button block size="lg" className="!bg-lime !text-navy" onClick={onChat}><MessageCircle size={18} />メッセージを送る</Button>
        <button onClick={onClose} className="mt-3 w-full py-2 text-[14px] font-bold opacity-80">続けて探す</button>
      </div>
      <style>{`@keyframes slideL{from{transform:translateX(-90px);opacity:0}}@keyframes slideR{from{transform:translateX(90px);opacity:0}}`}</style>
    </div>
  )
}

/* ---------- やりとりの一覧（状況ごとに整理） ---------- */
export function ContractBoard() {
  const { contracts, authUser, isAdmin } = useApp()
  const nav = useNavigate()
  const me = authUser?.uid
  const groups: { key: string; title: string; hint: string; list: Contract[] }[] = [
    { key: 'todo', title: '返事が必要', hint: '相手があなたの返事を待っています', list: contracts.filter(k => k.status === 'proposed' && initiator(k) !== me) },
    { key: 'wait', title: '相手の返事待ち', hint: '相手が返事をするとお知らせします', list: contracts.filter(k => k.status === 'proposed' && initiator(k) === me) },
    { key: 'active', title: isAdmin ? '指導中の指導者' : '指導中のクラブ', hint: '', list: contracts.filter(k => k.status === 'active') },
    { key: 'done', title: '終了・お断り', hint: '', list: contracts.filter(k => ['completed', 'declined', 'withdrawn'].includes(k.status)) },
  ]
  if (!contracts.length) return <Empty icon={<Handshake />} title="やりとりはまだありません" text="「スワイプで探す」から、気になる相手にいいねを送りましょう" />
  return (
    <div className="space-y-5">
      {groups.filter(g => g.list.length).map(g => (
        <div key={g.key}>
          <div className="mb-2 flex items-baseline gap-2 px-1"><span className="text-[14px] font-black">{g.title}</span><span className="text-[12px] font-bold text-brand">{g.list.length}件</span>{g.hint && <span className="text-[11px] text-ink-3">{g.hint}</span>}</div>
          <div className="space-y-2">
            {g.list.map((k, i) => {
              const meCoach = k.coach === me
              const other = meCoach ? k.clubName : k.coachName
              return (
                <Card key={k.id} onClick={() => nav(`/requests/${k.id}`)} style={stagger(i)} className={cx('flex animate-up items-center gap-3', g.key === 'todo' && 'ring-2 ring-red-200')}>
                  <Avatar name={other} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><span className="truncate font-bold">{other}</span><span className="shrink-0 text-[11px] text-ink-3">{initiator(k) === me ? (meCoach ? 'あなたが応募' : 'あなたが依頼') : meCoach ? 'クラブから依頼' : '指導者から応募'}</span></div>
                    <div className="truncate text-[13px] text-ink-2">{k.title}・1回 {yen(k.fee)}</div>
                    <div className="mt-1 flex items-center gap-2">{contractBadge(k, me)}<span className="text-[11px] text-ink-3">{relTime(k.at)}</span></div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- 絞り込み（この端末に保存） ---------- */
interface Filter { maxKm: number; days: number[]; minFee: number; skill: string }
const NOF: Filter = { maxKm: 0, days: [], minFee: 0, skill: '' }
function useFilter(uid?: string) {
  const key = `mcmt_filter_${uid || ''}`
  const [f, setF] = useState<Filter>(() => { try { return { ...NOF, ...JSON.parse(localStorage.getItem(key) || '{}') } } catch { return NOF } })
  const save = (v: Filter) => { setF(v); try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* noop */ } }
  const count = (f.maxKm ? 1 : 0) + (f.days.length ? 1 : 0) + (f.minFee ? 1 : 0) + (f.skill ? 1 : 0)
  return { f, save, count }
}
function FilterSheet({ open, onClose, f, save, coach }: { open: boolean; onClose: () => void; f: Filter; save: (v: Filter) => void; coach: boolean }) {
  const pill = (on: boolean) => cx('rounded-full border px-3 py-1.5 text-[13px] font-bold transition active:scale-95', on ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink-2')
  return (
    <Sheet open={open} onClose={onClose} title="絞り込み" footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => save(NOF)}>条件をクリア</Button><Button className="flex-1" onClick={onClose}>この条件で探す</Button></div>}>
      <div className="mb-1.5 text-[13px] font-bold text-ink-2">距離</div>
      <div className="mb-4 flex flex-wrap gap-2">{[[0, '指定なし'], [5, '5km以内'], [10, '10km以内'], [20, '20km以内']].map(([v, l]) => <button key={v} onClick={() => save({ ...f, maxKm: v as number })} className={pill(f.maxKm === v)}>{l}</button>)}</div>
      <div className="mb-1.5 text-[13px] font-bold text-ink-2">{coach ? '活動する曜日（どれかを含む）' : '指導できる曜日（どれかに対応）'}</div>
      <div className="mb-4 flex gap-1.5">{[1, 2, 3, 4, 5, 6, 0].map(d => <button key={d} onClick={() => save({ ...f, days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d] })} className={cx('h-10 flex-1 rounded-xl border text-[14px] font-bold', f.days.includes(d) ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink-2')}>{DOW[d]}</button>)}</div>
      {coach ? (<>
        <div className="mb-1.5 text-[13px] font-bold text-ink-2">謝金（1回あたり）</div>
        <div className="flex flex-wrap gap-2">{[[0, '指定なし'], [5000, '5,000円以上'], [7000, '7,000円以上'], [10000, '10,000円以上']].map(([v, l]) => <button key={v} onClick={() => save({ ...f, minFee: v as number })} className={pill(f.minFee === v)}>{l}</button>)}</div>
      </>) : (<>
        <div className="mb-1.5 text-[13px] font-bold text-ink-2">得意な指導</div>
        <div className="flex flex-wrap gap-2"><button onClick={() => save({ ...f, skill: '' })} className={pill(!f.skill)}>指定なし</button>{SKILLS.map(s => <button key={s} onClick={() => save({ ...f, skill: s })} className={pill(f.skill === s)}>{s}</button>)}</div>
      </>)}
    </Sheet>
  )
}
function FilterBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-ink-2">{total}件の候補・相性の高い順</span>
      <button onClick={onOpen} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold shadow-card active:scale-95', count ? 'bg-navy text-white' : 'bg-white text-ink')}><SlidersHorizontal size={15} />絞り込み{count ? `（${count}）` : ''}</button>
    </div>
  )
}
/** 相性の理由（合う点は緑、気をつける点は黄色） */
function Reasons({ m }: { m: MatchResult }) {
  return (
    <div className="space-y-1">
      {m.good.slice(0, 4).map(g => <div key={g} className="flex items-start gap-1.5 text-[13px]"><Check size={15} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />{g}</div>)}
      {m.warn.slice(0, 2).map(w => <div key={w} className="flex items-start gap-1.5 text-[13px] text-amber-700"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{w}</div>)}
    </div>
  )
}

const Chip = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => <span className="flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-[12px] font-bold text-ink-2">{icon}{children}</span>

/* ================= 指導者：クラブの募集をスワイプ ================= */
function CoachMatch() {
  const { be, profile, authUser, contracts, toast } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as 'swipe' | 'list') || 'swipe'
  const [posts, setPosts] = useState<Post[] | null>(null)
  const passed = usePassed(authUser?.uid)
  const [last, setLast] = useState<{ kind: 'pass' | 'like'; id: string; contractId?: string } | null>(null)
  const [info, setInfo] = useState<Post | null>(null)
  const [matched, setMatched] = useState<{ club: string; id: string; photo?: string } | null>(null)
  const flt = useFilter(authUser?.uid)
  const [fOpen, setFOpen] = useState(false)
  useEffect(() => be.watchOpenPosts(setPosts), [be])
  const me = authUser?.uid || ''
  const ready = coachReady(profile)
  const deck = useMemo(() => {
    if (!posts || !profile) return []
    // 自分が応募済み・成立済みの募集は出さない（クラブから届いた依頼は、カードに「依頼が届いています」と出して残す）
    const taken = new Set(contracts.filter(k => k.coach === me && (k.status === 'active' || (k.status === 'proposed' && initiator(k) === me))).map(k => k.postId || '').filter(Boolean))
    return posts
      .filter(p => p.ownerUid !== me && !profile.clubIds.includes(p.clubId) && !passed.ids.includes(p.id) && !taken.has(p.id))
      .map(p => {
        const m = matchFit(profile, { lat: p.lat, lon: p.lon, days: p.days, sport: p.sport, skills: p.skills, ages: p.ages, level: p.level, fee: p.fee })
        const offer = contracts.find(k => k.coach === me && k.clubId === p.clubId && k.status === 'proposed' && initiator(k) !== me)
        return { ...p, score: m.score + (offer ? 100 : 0), m, offer, isNew: Date.now() - p.at < 3 * 864e5 }
      })
      .filter(p => p.offer || ((!flt.f.maxKm || p.m.dist <= flt.f.maxKm) && (!flt.f.days.length || p.days.some(d => flt.f.days.includes(d))) && (!flt.f.minFee || p.fee >= flt.f.minFee)))
      .sort((a, b) => b.score - a.score)
  }, [posts, profile, contracts, passed.ids, me, flt.f])
  if (!profile || !authUser) return null
  const waiting = contracts.filter(k => k.status === 'proposed' && initiator(k) !== me).length

  const like = async (p: (typeof deck)[number]) => {
    if (!ready) { toast('本人確認と安全研修が終わると応募できます'); return }
    try {
      if (p.offer) { // クラブから依頼が届いている → その場で成立
        await be.setContractStatus(p.offer.id, 'active')
        if (p.offer.clubCode) await be.joinClub(p.offer.clubCode, me)
        await be.sendMessage(p.offer.id, { from: me, fromName: profile.name, text: 'お引き受けします。よろしくお願いします。', at: Date.now() })
        await be.notify(p.ownerUid, `【マッチング成立】${profile.name}さんが依頼を引き受けました`, 'contract').catch(() => {})
        setMatched({ club: p.clubName, id: p.offer.id, photo: p.photo }); setLast(null)
        return
      }
      const msg = `はじめまして、${profile.name}です。「${p.title}」に応募します。${profile.license ? `${profile.license}。` : ''}よろしくお願いいたします。`
      const id = await be.createContract({ coach: me, coachName: profile.name, player: p.ownerUid, playerName: p.ownerName, clubId: p.clubId, clubName: p.clubName, title: p.title, fee: p.fee, message: msg, status: 'proposed', by: me, postId: p.id, at: Date.now() })
      await be.sendMessage(id, { from: me, fromName: profile.name, text: msg, at: Date.now() })
      await be.notify(p.ownerUid, `【応募】${profile.name}さんが「${p.title}」に応募しました`, 'contract').catch(() => {})
      setLast({ kind: 'like', id: p.id, contractId: id })
      toast(`${p.clubName}に応募しました`)
    } catch { toast('応募できませんでした。時間をおいてお試しください') }
  }
  const pass = (p: Post) => { passed.add(p.id); setLast({ kind: 'pass', id: p.id }) }
  const undo = async () => {
    if (!last) return
    if (last.kind === 'pass') passed.remove(last.id)
    else if (last.contractId) { await be.setContractStatus(last.contractId, 'withdrawn').catch(() => {}); toast('応募を取り消しました') }
    setLast(null)
  }

  return (
    <>
      <PageHeader title="マッチング" sub="クラブの募集を探す" />
      <Segmented value={tab} onChange={v => setSp({ tab: v }, { replace: true })} options={[{ value: 'swipe', label: 'スワイプで探す' }, { value: 'list', label: `やりとり${waiting ? `（${waiting}）` : ''}` }]} />
      <div className="mt-3 space-y-3">
        {tab === 'list' ? <ContractBoard /> : (
          <>
            {!ready && <CoachSetup compact />}
            <FilterBar count={flt.count} total={deck.length} onOpen={() => setFOpen(true)} />
            {posts === null ? <Skeleton className="h-[440px]" /> : (
              <SwipeDeck
                items={deck}
                likeLabel="応募"
                reserve={370}
                passLabel="見送る"
                onLike={like}
                onPass={pass}
                onInfo={setInfo}
                canUndo={!!last}
                onUndo={undo}
                empty={<Empty icon={<Megaphone />} title={flt.count ? '条件に合う募集はありません' : '新しい募集はすべて見ました'} text="あなたの種目・地域に新しい募集が出たらお知らせします" action={<div className="flex flex-col gap-2">{flt.count > 0 && <Button variant="soft" onClick={() => flt.save(NOF)}>絞り込みをクリア</Button>}{passed.ids.length > 0 && <Button variant="soft" onClick={passed.clear}>見送った募集をもう一度見る</Button>}</div>} />}
                render={p => (
                  <div className="flex h-full flex-col">
                    <div className={cx('relative bg-gradient-to-br from-navy to-brand px-5 pb-5 pt-6 text-white', safePhoto(p.photo) && 'flex min-h-[180px] flex-col justify-end')}>
                      {safePhoto(p.photo) && <><img src={p.photo} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/70 to-navy/20" /></>}
                      <div className="relative">
                      {p.offer ? <div className="mb-2 mr-16 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-[12px] font-black text-navy"><Heart size={13} fill="currentColor" />このクラブから依頼が届いています</div> : p.isNew ? <div className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-[12px] font-black">NEW 新着の募集</div> : null}
                      <div className="text-[13px] font-bold opacity-80">{p.clubName}</div>
                      <div className="mt-1 pr-16 text-[22px] font-black leading-snug">{p.title}</div>
                      </div>
                      <div className="absolute right-4 top-6 rounded-full bg-white p-1"><Ring value={p.m.score} size={60} stroke={6}><div className="text-center leading-none text-ink"><div className="text-[17px] font-black">{p.m.score}</div><div className="text-[9px] text-ink-3">相性</div></div></Ring></div>
                    </div>
                    <div className="flex-1 space-y-3 overflow-hidden p-5">
                      <div className="flex flex-wrap gap-1.5">
                        <Chip icon={<CalendarDays size={13} />}>{p.days.map(d => DOW[d]).join('・')} {p.start}〜</Chip>
                        <Chip icon={<MapPin size={13} />}>{p.m.dist.toFixed(1)}km</Chip>
                        <Chip icon={<Wallet size={13} />}>1回 {yen(p.fee)}</Chip>
                      </div>
                      <Reasons m={{ ...p.m, warn: profile.rate && p.fee < profile.rate ? [...p.m.warn, `希望の謝金（${yen(profile.rate)}）より低め`] : p.m.warn }} />
                      {(p.skills?.length || p.ages?.length || p.level) ? <div className="flex flex-wrap gap-1">{[...(p.ages || []), ...(p.level ? [p.level] : []), ...(p.skills || [])].slice(0, 6).map(t => <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand">{t}</span>)}</div> : null}
                      {p.note && <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-2">{p.note}</p>}
                      <div className="text-[11px] text-ink-3">{p.areaLabel}・{relTime(p.at)}に募集</div>
                    </div>
                  </div>
                )}
              />
            )}
            <HowItWorks coach />
          </>
        )}
      </div>
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.title}>
        {info && <><div className="text-[13px] font-bold text-ink-2">{info.clubName}（{info.areaLabel}）</div><p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{info.note || '詳しい内容はまだ書かれていません。'}</p><p className="mt-4 text-[12px] text-ink-3">カードを右にスワイプすると応募できます。</p><div className="mt-3 text-right"><ReportButton type="post" id={info.id} name={info.title} /></div></>}
      </Sheet>
      <FilterSheet open={fOpen} onClose={() => setFOpen(false)} f={flt.f} save={flt.save} coach />
      {matched && <MatchModal a={profile.name} aPhoto={profile.photo} b={matched.club} bPhoto={matched.photo} sub={`${matched.club}の指導者になりました`} onChat={() => nav(`/requests/${matched.id}`)} onClose={() => setMatched(null)} />}
    </>
  )
}

/* ================= クラブ運営：指導者をスワイプ ================= */
type Cand = Profile & { id: string; m: MatchResult; app?: Contract }
function ClubMatch() {
  const { be, club, profile, authUser, contracts, events, toast } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = (sp.get('tab') as 'swipe' | 'list') || 'swipe'
  const [list, setList] = useState<Profile[] | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const passed = usePassed(authUser?.uid)
  const [last, setLast] = useState<{ kind: 'pass' | 'like'; id: string; contractId?: string } | null>(null)
  const [info, setInfo] = useState<Cand | null>(null)
  const [matched, setMatched] = useState<{ name: string; id: string; photo?: string } | null>(null)
  const flt = useFilter(authUser?.uid)
  const [fOpen, setFOpen] = useState(false)
  useEffect(() => { if (club) be.listCoaches(club.sport).then(setList).catch(() => setList([])) }, [be, club?.sport, club?.coachUids.length])
  useEffect(() => (club ? be.watchClubPosts(club.id, setPosts) : undefined), [be, club?.id])
  const me = authUser?.uid || ''
  const clubDays = useMemo(() => {
    const cnt: Record<number, number> = {}
    events.forEach(e => { const d = parseDate(e.date).getDay(); cnt[d] = (cnt[d] || 0) + 1 })
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => +d)
  }, [events])
  const mine = contracts.filter(k => club && k.clubId === club.id)
  // 求める条件：募集が出ていればその条件、なければクラブの活動日から
  const need = useMemo(() => {
    const op = posts.find(p => p.status === 'open')
    return club ? { lat: club.lat, lon: club.lon, sport: club.sport, days: op?.days || clubDays, skills: op?.skills, ages: op?.ages, level: op?.level, fee: op?.fee } : { lat: 0, lon: 0, sport: '', days: [] }
  }, [club, posts, clubDays])
  const deck: Cand[] = useMemo(() => {
    if (!list || !club) return []
    return list
      .filter(p => p.uid !== me && !club.coachUids.includes(p.uid) && coachReady(p) && !passed.ids.includes(p.uid))
      .filter(p => !mine.some(k => k.coach === p.uid && (k.status === 'active' || (k.status === 'proposed' && initiator(k) === me))))
      .map(p => ({ ...p, id: p.uid, m: matchFit(p, need), app: mine.find(k => k.coach === p.uid && k.status === 'proposed' && initiator(k) === p.uid) }))
      .filter(c => c.app || ((!flt.f.maxKm || c.m.dist <= flt.f.maxKm) && (!flt.f.days.length || (c.days || []).some(d => flt.f.days.includes(d))) && (!flt.f.skill || (c.skills || []).includes(flt.f.skill))))
      .sort((a, b) => Number(!!b.app) - Number(!!a.app) || b.m.score - a.m.score)
  }, [list, club, mine, passed.ids, need, me, flt.f])
  if (!club || !profile || !authUser) return null
  const openPost = posts.find(p => p.status === 'open')
  const counts = {
    todo: mine.filter(k => k.status === 'proposed' && initiator(k) !== me).length,
    wait: mine.filter(k => k.status === 'proposed' && initiator(k) === me).length,
    active: mine.filter(k => k.status === 'active').length,
  }

  const like = async (c: Cand) => {
    try {
      if (c.app) { // 指導者から応募が届いている → その場で成立
        await be.setContractStatus(c.app.id, 'active')
        await be.addCoach(club.id, c.uid)
        await be.sendMessage(c.app.id, { from: me, fromName: profile.name, text: 'ぜひお願いします。クラブの予定や選手の情報はアプリから確認できます。', at: Date.now() })
        await be.notify(c.uid, `【マッチング成立】${club.name}に採用されました`, 'contract').catch(() => {})
        setMatched({ name: c.name, id: c.app.id, photo: c.photo }); setLast(null)
        return
      }
      const code = await be.createCoachInvite(club.id)
      const title = openPost?.title || `${clubDays.map(d => DOW[d] + '曜').join('・') || '週末'}の指導`
      const fee = openPost?.fee || c.rate || 6000
      const msg = `はじめまして。${club.name}の${profile.name}です。プロフィールを拝見し、ぜひ指導をお願いしたくご連絡しました。`
      const id = await be.createContract({ coach: c.uid, coachName: c.name, player: me, playerName: profile.name, clubId: club.id, clubName: club.name, clubCode: code, title: title.slice(0, 60), fee, message: msg, status: 'proposed', by: me, postId: openPost?.id, at: Date.now() })
      await be.sendMessage(id, { from: me, fromName: profile.name, text: msg, at: Date.now() })
      await be.notify(c.uid, `【指導の依頼】${club.name}から「${title}」の依頼が届きました`, 'contract').catch(() => {})
      setLast({ kind: 'like', id: c.uid, contractId: id })
      toast(`${c.name}さんに依頼を送りました`)
    } catch { toast('送れませんでした。時間をおいてお試しください') }
  }
  const pass = (c: Cand) => { passed.add(c.uid); setLast({ kind: 'pass', id: c.uid }) }
  const undo = async () => {
    if (!last) return
    if (last.kind === 'pass') passed.remove(last.id)
    else if (last.contractId) { await be.setContractStatus(last.contractId, 'withdrawn').catch(() => {}); toast('依頼を取り消しました') }
    setLast(null)
  }

  return (
    <>
      <PageHeader title="指導者マッチング" sub={`${club.sport}・${club.areaLabel}`} right={<div className="flex gap-2">
        <button onClick={() => nav('/posts')} aria-label={openPost ? '募集を管理' : '募集を出す'} className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand shadow-card active:scale-95"><Megaphone size={18} /></button>
        <button onClick={() => nav('/coaches')} aria-label="一覧で探す" className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand shadow-card active:scale-95"><Search size={18} /></button>
      </div>} />
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[['todo', '返事が必要', counts.todo, 'text-red-500'], ['wait', '相手の返事待ち', counts.wait, 'text-amber-500'], ['active', '指導中', counts.active, 'text-emerald-600']].map(([k, l, n, c], i) => (
          <button key={k as string} onClick={() => setSp({ tab: 'list' }, { replace: true })} style={stagger(i)} className="flex animate-up items-center gap-2 rounded-2xl bg-white px-3 py-2 text-left shadow-card active:scale-[.98]">
            <span className={cx('text-[20px] font-black leading-none', c as string)}>{n as number}</span><span className="text-[11px] font-bold leading-tight text-ink-2">{l}</span>
          </button>
        ))}
      </div>
      <Segmented value={tab} onChange={v => setSp({ tab: v }, { replace: true })} options={[{ value: 'swipe', label: 'スワイプで探す' }, { value: 'list', label: `やりとり${counts.todo ? `（${counts.todo}）` : ''}` }]} />
      <div className="mt-3 space-y-3">
        {tab === 'list' ? <ContractBoard /> : (
          <>
            <FilterBar count={flt.count} total={deck.length} onOpen={() => setFOpen(true)} />
            {list === null ? <Skeleton className="h-[440px]" /> : (
              <SwipeDeck
                items={deck}
                likeLabel={'依頼'}
                reserve={430}
                passLabel="見送る"
                onLike={like}
                onPass={pass}
                onInfo={setInfo}
                canUndo={!!last}
                onUndo={undo}
                empty={<Empty icon={<Search />} title="条件に合う指導者はすべて見ました" text="募集を出しておくと、条件の合う近くの指導者にお知らせが届き、応募を待てます" action={<div className="flex flex-col gap-2">{flt.count > 0 && <Button variant="soft" onClick={() => flt.save(NOF)}>絞り込みをクリア</Button>}{passed.ids.length > 0 && <Button variant="soft" onClick={passed.clear}>見送った指導者をもう一度見る</Button>}<Button onClick={() => nav('/posts')}><Megaphone size={16} />募集を出す</Button></div>} />}
                render={c => (
                  <div className="flex h-full flex-col">
                    <div className="relative flex flex-col items-center bg-gradient-to-br from-navy to-brand px-5 pb-4 pt-5 text-white">
                      <div className="rounded-full ring-4 ring-white/30"><Avatar name={c.name} size={c.photo ? 76 : 60} photo={c.photo} /></div>
                      <div className="mt-1.5 text-[21px] font-black">{c.name}</div>
                      <div className="text-[13px] opacity-80">{(c.sports || []).join('・')}・{c.areaLabel}</div>
                      {c.app && <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-lime px-3 py-1 text-[12px] font-black text-navy"><Heart size={13} fill="currentColor" />あなたのクラブに応募しています</div>}
                      <div className="absolute right-4 top-5 rounded-full bg-white p-1"><Ring value={c.m.score} size={56} stroke={6}><div className="text-center leading-none text-ink"><div className="text-[16px] font-black">{c.m.score}</div><div className="text-[9px] text-ink-3">相性</div></div></Ring></div>
                    </div>
                    <div className="flex-1 space-y-2.5 overflow-hidden px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="ok"><BadgeCheck size={12} />本人確認・<GraduationCap size={12} />安全研修 済み</Badge>
                        {c.licenseVerified && <Badge tone="info"><BadgeCheck size={12} />資格確認済み</Badge>}
                        {c.teacher && <Badge tone="info">現職の教員</Badge>}
                        {c.ratingCount ? <Badge tone="warn"><Star size={12} />{c.ratingAvg}（{c.ratingCount}件）</Badge> : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip icon={<MapPin size={13} />}>{c.m.dist.toFixed(1)}km</Chip>
                        <Chip icon={<CalendarDays size={13} />}>{(c.days || []).map(d => DOW[d]).join('・') || '曜日未設定'}</Chip>
                        {c.rate ? <Chip icon={<Wallet size={13} />}>希望 {yen(c.rate)}</Chip> : null}
                      </div>
                      <Reasons m={c.m} />
                      {(c.skills?.length || c.license) ? <div className="flex flex-wrap gap-1">{c.license && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{c.license}</span>}{(c.skills || []).slice(0, 4).map(t => <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand">{t}</span>)}</div> : null}
                      {c.bio && <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-2">{c.bio}</p>}
                    </div>
                  </div>
                )}
              />
            )}
            <HowItWorks coach={false} />
          </>
        )}
      </div>
      <Sheet open={!!info} onClose={() => setInfo(null)} title={info?.name}>
        {info && <><div className="text-[13px] text-ink-2">{(info.sports || []).join('・')}／{info.areaLabel}／{km(club.lat, club.lon, info.lat ?? club.lat, info.lon ?? club.lon).toFixed(1)}km</div>{info.license && <p className="mt-2 text-[14px] font-bold">{info.license}</p>}<p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{info.bio || '自己紹介はまだありません。'}</p><p className="mt-4 text-[12px] text-ink-3">カードを右にスワイプすると、{openPost ? `募集「${openPost.title}」の条件で` : ''}依頼を送れます。送ったあとはメッセージで条件を相談できます。</p><div className="mt-3 text-right"><ReportButton type="user" id={info.uid} name={info.name} /></div></>}
      </Sheet>
      <FilterSheet open={fOpen} onClose={() => setFOpen(false)} f={flt.f} save={flt.save} coach={false} />
      {matched && <MatchModal a={club.name} aPhoto={club.photo} b={matched.name} bPhoto={matched.photo} sub={`${matched.name}さんがクラブの指導者になりました`} onChat={() => nav(`/requests/${matched.id}`)} onClose={() => setMatched(null)} />}
    </>
  )
}

export default function Match() {
  const { isAdmin, coachMode } = useApp()
  if (isAdmin) return <ClubMatch />
  if (coachMode) return <CoachMatch />
  return <><PageHeader title="マッチング" /><Empty icon={<Handshake />} title="マッチングはクラブの運営者と指導者が使えます" /></>
}
