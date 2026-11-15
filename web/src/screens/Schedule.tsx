import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Plus } from 'lucide-react'
import { useApp } from '../lib/store'
import { attCounts } from '../components/parts'
import { EventEditor } from '../components/EventEditor'
import { Badge, Empty, PageHeader, Segmented, cx, stagger } from '../components/ui'
import { addDays, DOW, iso, parseDate, today, wbgtFor, wbgtLevel } from '../lib/util'

export default function Schedule() {
  const { events, isAdmin, myPlayers, players, weather, isCoach } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<'up' | 'past'>('up')
  const [edit, setEdit] = useState(false)
  const [focus, setFocus] = useState<string | null>(null)
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today(), i)), [])
  const jump = (d: string) => {
    const ev = events.find(e => e.date === d)
    if (!ev) return
    setFocus(ev.id)
    document.getElementById('ev-' + ev.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setFocus(null), 1600)
  }
  useEffect(() => { if (sp.get('new') && isAdmin) { setEdit(true); setSp({}, { replace: true }) } }, [sp])
  const t = iso(today())
  const list = useMemo(() => {
    const xs = events.filter(e => (tab === 'up' ? e.date >= t : e.date < t))
    xs.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    return tab === 'past' ? xs.reverse() : xs
  }, [events, tab, t])
  const groups = useMemo(() => {
    const g: { key: string; label: string; items: typeof list }[] = []
    list.forEach(e => {
      const d = parseDate(e.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      let grp = g.find(x => x.key === key)
      if (!grp) { grp = { key, label: `${d.getFullYear()}年${d.getMonth() + 1}月`, items: [] }; g.push(grp) }
      grp.items.push(e)
    })
    return g
  }, [list])

  return (
    <>
      <PageHeader title="予定" right={isAdmin && <button onClick={() => setEdit(true)} aria-label="予定を追加" className="grid h-10 w-10 place-items-center rounded-full bg-navy text-white active:scale-95"><Plus size={22} /></button>} />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'up', label: 'これから' }, { value: 'past', label: 'これまで' }]} />
      {tab === 'up' && (
        <div className="no-scrollbar -mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {strip.map((d, i) => {
            const ds = iso(d)
            const evs = events.filter(e => e.date === ds)
            const live = evs.filter(e => e.status !== 'canceled')
            const w = weather && live[0] ? wbgtFor(weather, ds, live[0].start, live[0].minutes, live[0].indoor) : null
            const lv = w ? wbgtLevel(w.max).lv : -1
            return (
              <button key={ds} onClick={() => jump(ds)} style={stagger(i)} className={cx('flex w-[52px] shrink-0 snap-start animate-up flex-col items-center rounded-2xl py-2 transition active:scale-95', i === 0 ? 'bg-navy text-white' : evs.length ? 'bg-white shadow-card' : 'bg-transparent text-ink-3')}>
                <span className={cx('text-[11px] font-bold', i !== 0 && (d.getDay() === 0 ? 'text-red-500' : d.getDay() === 6 ? 'text-brand' : ''))}>{DOW[d.getDay()]}</span>
                <span className="text-[18px] font-black leading-tight">{d.getDate()}</span>
                <span className={cx('mt-0.5 h-1.5 w-1.5 rounded-full', !evs.length ? 'bg-transparent' : !live.length ? 'bg-red-400' : lv >= 3 ? 'bg-red-500' : lv === 2 ? 'bg-amber-400' : i === 0 ? 'bg-lime' : 'bg-emerald-500')} />
              </button>
            )
          })}
        </div>
      )}
      {!list.length && <div className="mt-4"><Empty icon={<CalendarPlus />} title={tab === 'up' ? '今後の予定はありません' : '過去の予定はありません'} action={isAdmin && tab === 'up' ? <button onClick={() => setEdit(true)} className="font-bold text-brand">予定を追加する</button> : undefined} /></div>}
      {groups.map(g => (
        <section key={g.key} className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-bold text-ink-2">{g.label}</h2>
          <div className="space-y-2">
            {g.items.map((e, idx) => {
              const d = parseDate(e.date)
              const isToday = e.date === t
              const w = weather && e.status !== 'canceled' ? wbgtFor(weather, e.date, e.start, e.minutes, e.indoor) : null
              const lv = w ? wbgtLevel(w.max) : null
              const mineMissing = !isAdmin && !isCoach && myPlayers.some(p => !e.att[p.id])
              const c = attCounts(e, players)
              return (
                <button key={e.id} id={'ev-' + e.id} onClick={() => nav(`/event/${e.id}`)} style={stagger(idx)} className={cx('flex w-full animate-up items-center gap-3 rounded-xl2 bg-white p-3 text-left shadow-card transition active:scale-[.99]', isToday && 'ring-2 ring-brand', focus === e.id && 'ring-4 ring-lime')}>
                  <div className={cx('grid w-14 shrink-0 place-items-center rounded-2xl py-2', d.getDay() === 0 ? 'bg-red-50 text-red-600' : d.getDay() === 6 ? 'bg-brand-50 text-brand' : 'bg-slate-100 text-ink')}>
                    <div className="text-[20px] font-black leading-none">{d.getDate()}</div>
                    <div className="mt-0.5 text-[11px] font-bold">{DOW[d.getDay()]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cx('truncate text-[15px] font-bold', e.status === 'canceled' && 'text-ink-3 line-through')}>{e.title}</div>
                    <div className="truncate text-[12px] text-ink-2">{e.start}〜・{e.venue}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {e.status === 'canceled' && <Badge tone="danger">中止</Badge>}
                      {lv && lv.lv >= 1 && <Badge tone={lv.tone}>暑さ {lv.label}</Badge>}
                      {mineMissing && e.status !== 'canceled' && tab === 'up' && <Badge tone="warn">出欠 未回答</Badge>}
                      {(isAdmin || isCoach) && e.status !== 'canceled' && <Badge tone="none">参加 {c.yes}／{c.total}</Badge>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
      <EventEditor open={edit} onClose={() => setEdit(false)} />
    </>
  )
}
