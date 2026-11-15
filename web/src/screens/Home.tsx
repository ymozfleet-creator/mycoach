import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CalendarPlus, ChevronRight, ClipboardList, HeartPulse, Megaphone, Search, ShieldAlert, ShieldCheck, Sparkles, Thermometer, Wallet, Handshake } from 'lucide-react'
import { useApp } from '../lib/store'
import { AttButtons, attCounts, EventCard, useEventWbgt } from '../components/parts'
import { Avatar, Badge, Card, CountUp, Empty, Ring, Section, cx, stagger } from '../components/ui'
import { GuidelineCard } from '../components/Guideline'
import { ComposeSheet, ConditionSheet } from '../components/sheets'
import type { ClubEvent } from '../lib/types'
import { addDays, dateLabel, iso, loadStatus, relTime, today, wbgtFor, wbgtLevel, yen } from '../lib/util'

const greet = () => { const h = new Date().getHours(); return h < 11 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'おつかれさまです' }

function Hello() {
  const { profile, club } = useApp()
  return (
    <div className="pb-1 pt-[calc(env(safe-area-inset-top)+20px)]">
      <p className="text-[13px] font-bold text-ink-2">{profile?.org ? `${profile.org}／` : ''}{club?.name}</p>
      <h1 className="mt-0.5 text-[24px] font-black tracking-tight">{greet()}、{profile?.name.split(' ').slice(-1)[0]}さん</h1>
    </div>
  )
}

function useUpcoming() {
  const { events } = useApp()
  const t = iso(today())
  return useMemo(() => events.filter(e => e.date >= t).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [events, t])
}

function HeatAdvice({ e }: { e: ClubEvent }) {
  const w = useEventWbgt(e)
  if (w.state !== 'ok' || w.level.lv < 2) return null
  return (
    <div className={cx('mt-3 flex gap-2 rounded-2xl p-3 text-[13px]', w.level.lv >= 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800')}>
      <AlertTriangle size={18} className="shrink-0" /><span><b>{w.level.label}</b>：{w.level.advice}</span>
    </div>
  )
}

function Alert({ icon, tone, title, text, onClick, i = 0 }: { icon: React.ReactNode; tone: 'danger' | 'warn' | 'info'; title: string; text?: string; onClick?: () => void; i?: number }) {
  const t = { danger: 'bg-red-50 text-red-600', warn: 'bg-amber-50 text-amber-700', info: 'bg-brand-50 text-brand' }[tone]
  return (
    <Card onClick={onClick} style={stagger(i)} className="flex items-center gap-3 !p-3.5">
      <div className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', t)}>{icon}</div>
      <div className="min-w-0 flex-1"><div className="text-[15px] font-bold">{title}</div>{text && <div className="truncate text-[13px] text-ink-2">{text}</div>}</div>
      {onClick && <ChevronRight size={18} className="text-ink-3" />}
    </Card>
  )
}

/* ---------- 保護者・生徒 ---------- */
function MemberHome() {
  const { be, club, myPlayers, fees, announcements, conditions } = useApp()
  const nav = useNavigate()
  const up = useUpcoming()
  const next = up.find(e => e.status !== 'canceled') || up[0]
  const unpaid = fees.filter(f => f.status === 'unpaid')
  const urgent = announcements.find(a => a.kind === 'urgent' && Date.now() - a.at < 3 * 864e5)
  const [cond, setCond] = useState(false)
  const t = iso(today())
  const needCond = myPlayers.some(p => !conditions.some(c => c.playerId === p.id && c.date === t))
  if (!club) return null
  return (
    <>
      <Hello />
      <div className="mt-4 space-y-2">
        {urgent && <Alert icon={<Megaphone size={20} />} tone="danger" title="重要なお知らせ" text={urgent.text} onClick={() => nav('/news')} />}
        {unpaid.length > 0 && <Alert icon={<Wallet size={20} />} tone="warn" title={`会費のお支払い（${unpaid.length}件）`} text={`${yen(unpaid.reduce((s, f) => s + f.amount, 0))}・タップしてお支払い`} onClick={() => nav('/fees')} />}
      </div>

      <Section title="次の活動">
        {next ? (
          <EventCard e={next} onClick={() => nav(`/event/${next.id}`)}>
            <HeatAdvice e={next} />
            {next.status !== 'canceled' && myPlayers.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-line pt-3">
                {myPlayers.map(p => (
                  <div key={p.id}>
                    <div className="mb-1.5 text-[13px] font-bold">{p.name}さんの出欠</div>
                    <AttButtons value={next.att[p.id]} onChange={a => be.setAttendance(club.id, next.id, p.id, a)} />
                  </div>
                ))}
              </div>
            )}
          </EventCard>
        ) : <Empty icon={<CalendarPlus />} title="予定はまだありません" text="運営から予定が登録されるとここに表示されます" />}
      </Section>

      {myPlayers.length > 0 && (
        <Card onClick={() => setCond(true)} className="mt-3 flex items-center gap-3 bg-gradient-to-r from-brand to-[#3B82F6] !p-4 text-white">
          <HeartPulse size={28} />
          <div className="flex-1"><div className="font-bold">今日の体調・練習を記録</div><div className="text-[12px] opacity-85">{needCond ? '10秒で終わります。けがの予防に役立ちます' : '今日の記録は済んでいます'}</div></div>
          <ChevronRight size={20} />
        </Card>
      )}

      {up.length > 1 && (
        <Section title="この先の予定" action={<button onClick={() => nav('/schedule')} className="text-[13px] font-bold text-brand">すべて見る</button>}>
          <Card className="divide-y divide-line !py-1">
            {up.slice(1, 4).map(e => (
              <button key={e.id} onClick={() => nav(`/event/${e.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                <div className="w-24 shrink-0 text-[13px] font-bold text-brand">{dateLabel(e.date)}</div>
                <div className="min-w-0 flex-1 truncate text-[14px]">{e.start}〜 {e.title}</div>
                {myPlayers.some(p => !e.att[p.id]) && e.status !== 'canceled' && <Badge tone="warn">未回答</Badge>}
                {e.status === 'canceled' && <Badge tone="danger">中止</Badge>}
              </button>
            ))}
          </Card>
        </Section>
      )}

      {announcements[0] && (
        <Section title="お知らせ" action={<button onClick={() => nav('/news')} className="text-[13px] font-bold text-brand">すべて見る</button>}>
          <Card onClick={() => nav('/news')}>
            <p className="line-clamp-3 text-[14px] leading-relaxed">{announcements[0].text}</p>
            <p className="mt-2 text-[12px] text-ink-3">{announcements[0].byName}・{relTime(announcements[0].at)}</p>
          </Card>
        </Section>
      )}
      <ConditionSheet open={cond} onClose={() => setCond(false)} players={myPlayers} />
    </>
  )
}

/* ---------- 指導者 ---------- */
function CoachHome() {
  const { players, conditions, contracts, authUser, profile } = useApp()
  const nav = useNavigate()
  const up = useUpcoming().filter(e => e.status !== 'canceled')
  const next = up.find(e => !e.coachUid || e.coachUid === authUser?.uid) || up[0]
  const watch = players.map(p => ({ p, s: loadStatus(conditions, p.id) })).filter(x => x.s.tone === 'danger' || x.s.tone === 'warn')
  const offers = contracts.filter(k => k.coach === authUser?.uid && k.status === 'proposed')
  return (
    <>
      <Hello />
      <div className="mt-4 space-y-2">
        {profile?.verified !== 'approved' && <Alert icon={<ShieldAlert size={20} />} tone="info" title="指導者の審査を完了しましょう" text="本人確認と安全研修が済むと、クラブから依頼が届きます" onClick={() => nav('/more')} />}
        {offers.length > 0 && <Alert icon={<Handshake size={20} />} tone="warn" title={`新しい指導の依頼（${offers.length}件）`} text={offers[0].clubName} onClick={() => nav('/requests')} />}
      </div>
      <Section title="次の指導">
        {next ? (() => {
          const c = attCounts(next, players)
          return (
            <EventCard e={next} onClick={() => nav(`/event/${next.id}`)}>
              <HeatAdvice e={next} />
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <div><div className="text-[22px] font-black text-emerald-600"><CountUp value={c.yes} /></div><div className="text-[11px] text-ink-2">参加</div></div>
                <div><div className="text-[22px] font-black text-ink-2"><CountUp value={c.no} /></div><div className="text-[11px] text-ink-2">欠席</div></div>
                <div><div className="text-[22px] font-black text-amber-600"><CountUp value={c.none + c.maybe} /></div><div className="text-[11px] text-ink-2">未定・未回答</div></div>
              </div>
              <button onClick={ev => { ev.stopPropagation(); nav(`/menu?event=${next.id}`) }} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-lime font-bold text-navy active:scale-[.98]"><Sparkles size={18} />この日の練習メニューをAIで作る</button>
            </EventCard>
          )
        })() : <Empty icon={<CalendarPlus />} title="予定はまだありません" />}
      </Section>
      <Section title="気をつけたい選手" action={<button onClick={() => nav('/players')} className="text-[13px] font-bold text-brand">選手一覧</button>}>
        {watch.length ? (
          <Card className="divide-y divide-line !py-1">
            {watch.map(({ p, s }) => (
              <button key={p.id} onClick={() => nav(`/player/${p.id}`)} className="flex w-full items-center gap-3 py-3 text-left">
                <Avatar name={p.name} size={36} />
                <div className="min-w-0 flex-1"><div className="font-bold">{p.name}</div><div className="text-[12px] text-ink-2">負荷比 {s.ratio.toFixed(2)}{s.sleep ? `・睡眠 ${s.sleep.toFixed(1)}時間` : ''}</div></div>
                <Badge tone={s.tone === 'danger' ? 'danger' : 'warn'}>{s.label}</Badge>
              </button>
            ))}
          </Card>
        ) : <Card className="text-[14px] text-ink-2">練習量が急に増えている選手はいません。</Card>}
      </Section>
    </>
  )
}

/* ---------- 運営 ---------- */
function AdminHome() {
  const { club, players, fees, contracts, authUser, events, conditions } = useApp()
  const nav = useNavigate()
  const [compose, setCompose] = useState(false)
  const up = useUpcoming().filter(e => e.status !== 'canceled')
  const next = up[0]
  const unpaid = fees.filter(f => f.status === 'unpaid')
  const noFees = fees.length === 0 && players.length > 0
  const noAnswer = next ? attCounts(next, players).none : 0
  const replies = contracts.filter(k => k.player === authUser?.uid && k.status === 'proposed')
  const risky = players.filter(p => loadStatus(conditions, p.id).tone === 'danger').length
  const todo: React.ReactNode[] = []
  if (noFees) todo.push(<Alert key="nf" icon={<Wallet size={20} />} tone="warn" title="今月の会費をまだ請求していません" text="ワンタップで全員分を請求できます" onClick={() => nav('/fees')} />)
  if (unpaid.length) todo.push(<Alert i={todo.length} key="up" icon={<Wallet size={20} />} tone="warn" title={`会費の未納 ${unpaid.length}件`} text={yen(unpaid.reduce((s, f) => s + f.amount, 0))} onClick={() => nav('/fees')} />)
  if (next && noAnswer) todo.push(<Alert i={todo.length} key="na" icon={<ClipboardList size={20} />} tone="info" title={`出欠の未回答 ${noAnswer}人`} text={`${dateLabel(next.date)} ${next.title}`} onClick={() => nav(`/event/${next.id}`)} />)
  if (risky) todo.push(<Alert i={todo.length} key="rk" icon={<HeartPulse size={20} />} tone="danger" title={`練習負荷が急増している選手 ${risky}人`} text="指導者と状況を確認しましょう" onClick={() => nav('/players')} />)
  if (replies.length) todo.push(<Alert i={todo.length} key="rp" icon={<Handshake size={20} />} tone="info" title={`指導者の返事待ち ${replies.length}件`} text={replies.map(r => r.coachName).join('、')} onClick={() => nav('/requests')} />)
  const thisMonth = events.filter(e => e.status !== 'canceled' && e.date.startsWith(iso(today()).slice(0, 7)) && e.date < iso(today()))
  return (
    <>
      <Hello />
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { i: <CalendarPlus size={22} />, l: '予定を追加', f: () => nav('/schedule?new=1') },
          { i: <Megaphone size={22} />, l: 'お知らせ', f: () => setCompose(true) },
          { i: <Search size={22} />, l: '指導者探し', f: () => nav('/coaches') },
          { i: <ClipboardList size={22} />, l: '実績報告', f: () => nav('/report') },
        ].map(a => (
          <button key={a.l} onClick={a.f} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-[12px] font-bold shadow-card active:scale-95">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">{a.i}</span>{a.l}
          </button>
        ))}
      </div>
      <Section title={todo.length ? `対応が必要なこと（${todo.length}）` : '対応が必要なこと'}>
        {todo.length ? <div className="space-y-2">{todo}</div> : <Card className="text-[14px] text-ink-2">いまは対応が必要なことはありません。</Card>}
      </Section>
      <Section title="次の活動" action={<button onClick={() => nav('/schedule')} className="text-[13px] font-bold text-brand">予定一覧</button>}>
        {next ? <EventCard e={next} onClick={() => nav(`/event/${next.id}`)}><HeatAdvice e={next} /></EventCard> : <Empty icon={<CalendarPlus />} title="予定がありません" action={<button onClick={() => nav('/schedule?new=1')} className="font-bold text-brand">予定を追加する</button>} />}
      </Section>
      <Section title="今月のようす">
        <div className="grid grid-cols-3 gap-2">
          <Card className="!p-3 text-center"><div className="text-[24px] font-black"><CountUp value={thisMonth.length} /><span className="text-[13px]">回</span></div><div className="text-[11px] text-ink-2">活動</div></Card>
          <Card className="!p-3 text-center" style={stagger(1)}><div className="text-[24px] font-black"><CountUp value={players.length} /><span className="text-[13px]">人</span></div><div className="text-[11px] text-ink-2">会員</div></Card>
          <Card className="flex flex-col items-center !p-3" style={stagger(2)}>
            <Ring value={fees.length ? fees.filter(f => f.status !== 'unpaid').length / fees.length : 0} size={48} stroke={6}><span className="text-[12px] font-black"><CountUp value={fees.length ? (fees.filter(f => f.status !== 'unpaid').length / fees.length) * 100 : 0} />%</span></Ring>
            <div className="mt-1 text-[11px] text-ink-2">会費回収</div>
          </Card>
        </div>
      </Section>
      <GuidelineCard />
      <ComposeSheet open={compose} onClose={() => setCompose(false)} />
      {club && null}
    </>
  )
}

/* ---------- 学校・教育委員会 ---------- */
function SchoolHome() {
  const { events, players, incidents, weather } = useApp()
  const nav = useNavigate()
  const t = iso(today())
  const from = iso(addDays(today(), -28))
  const past = events.filter(e => e.status !== 'canceled' && e.date < t && e.date >= from)
  const part = past.reduce((s, e) => s + Object.values(e.att).filter(a => a === 'yes').length, 0)
  const rate = past.length && players.length ? part / (past.length * players.length) : 0
  const low = players.map(p => ({ p, n: past.filter(e => e.att[p.id] === 'yes').length })).filter(x => past.length && x.n / past.length < 0.5).sort((a, b) => a.n - b.n)
  const week = events.filter(e => e.status !== 'canceled' && e.date >= t && e.date <= iso(addDays(today(), 7)))
  const hot = weather ? week.map(e => ({ e, w: wbgtFor(weather, e.date, e.start, e.minutes, e.indoor) })).filter(x => x.w && wbgtLevel(x.w.max).lv >= 2) : []
  return (
    <>
      <Hello />
      <p className="mt-1 text-[13px] text-ink-2">地域クラブでの生徒の活動状況を確認できます（閲覧のみ）。</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Card className="flex items-center gap-3 !p-3">
          <Ring value={rate} size={56}><span className="text-[13px] font-black"><CountUp value={rate * 100} />%</span></Ring>
          <div><div className="text-[12px] text-ink-2">4週の参加率</div><div className="text-[13px] font-bold">生徒 {players.length}人</div></div>
        </Card>
        <Card className="!p-3" style={stagger(1)}>
          <div className="text-[12px] text-ink-2">4週の活動</div>
          <div className="text-[26px] font-black leading-tight"><CountUp value={past.length} /><span className="text-[13px]">回</span></div>
          <div className="text-[12px] text-ink-2">延べ <CountUp value={part} />人が参加</div>
        </Card>
      </div>
      <Section title="今後1週間の暑さ">
        {!weather ? <Card className="text-[14px] text-ink-2">気象データを取得しています…</Card> : hot.length ? (
          <div className="space-y-2">{hot.map(({ e, w }, i) => { const L = wbgtLevel(w!.max); return <Alert key={e.id} i={i} icon={<Thermometer size={20} />} tone={L.lv >= 3 ? 'danger' : 'warn'} title={`${dateLabel(e.date)} ${L.label}（${w!.max}）`} text={`${e.start}〜 ${e.venue}`} onClick={() => nav(`/event/${e.id}`)} /> })}</div>
        ) : <Card className="flex items-center gap-3 text-[14px]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck size={20} /></span>今後1週間、熱中症の警戒が必要な活動はありません。</Card>}
      </Section>
      <GuidelineCard />
      <Section title="参加が少ない生徒" action={<button onClick={() => nav('/players')} className="text-[13px] font-bold text-brand">生徒一覧</button>}>
        {low.length ? (
          <Card className="divide-y divide-line !py-1">
            {low.slice(0, 5).map(({ p, n }, i) => (
              <div key={p.id} style={stagger(i)} className="flex animate-up items-center gap-3 py-2.5">
                <Avatar name={p.name} size={34} />
                <div className="min-w-0 flex-1"><div className="font-bold">{p.name}</div><div className="text-[12px] text-ink-2">{p.grade}</div></div>
                <Badge tone="warn">{n}／{past.length}回</Badge>
              </div>
            ))}
          </Card>
        ) : <Card className="text-[14px] text-ink-2">参加が半分未満の生徒はいません。</Card>}
      </Section>
      <Section title="安全の記録" action={<button onClick={() => nav('/safety')} className="text-[13px] font-bold text-brand">すべて見る</button>}>
        {incidents.length ? (
          <Card className="divide-y divide-line !py-1">
            {incidents.slice(0, 3).map(x => (
              <div key={x.id} className="py-2.5"><div className="flex items-center gap-2"><Badge tone={x.type === '事故' ? 'danger' : 'warn'}>{x.type}</Badge><span className="text-[12px] text-ink-3">{dateLabel(x.date)}</span></div><div className="mt-1 text-[14px]">{x.who}：{x.desc}</div></div>
            ))}
          </Card>
        ) : <Card className="text-[14px] text-ink-2">記録はありません。</Card>}
      </Section>
      <button onClick={() => nav('/report')} className="mt-6 flex w-full items-center gap-3 rounded-xl2 bg-white p-4 text-left shadow-card active:scale-[.99]">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand"><ClipboardList size={20} /></span>
        <span className="flex-1"><b className="block">月ごとの実績報告</b><span className="text-[12px] text-ink-2">活動回数・参加人数・安全記録をCSV・印刷で</span></span>
        <ChevronRight size={18} className="text-ink-3" />
      </button>
    </>
  )
}

export default function Home() {
  const { isAdmin, isCoach, isSchool } = useApp()
  if (isAdmin) return <AdminHome />
  if (isCoach) return <CoachHome />
  if (isSchool) return <SchoolHome />
  return <MemberHome />
}
