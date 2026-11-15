import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Plus } from 'lucide-react'
import { useApp } from '../lib/store'
import { attCounts } from '../components/parts'
import { EventEditor } from '../components/EventEditor'
import { Badge, Empty, PageHeader, Segmented, cx } from '../components/ui'
import { DOW, iso, parseDate, today, wbgtFor, wbgtLevel } from '../lib/util'

export default function Schedule() {
  const { events, isAdmin, myPlayers, players, weather, isCoach } = useApp()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<'up' | 'past'>('up')
  const [edit, setEdit] = useState(false)
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
      {!list.length && <div className="mt-4"><Empty icon={<CalendarPlus />} title={tab === 'up' ? '今後の予定はありません' : '過去の予定はありません'} action={isAdmin && tab === 'up' ? <button onClick={() => setEdit(true)} className="font-bold text-brand">予定を追加する</button> : undefined} /></div>}
      {groups.map(g => (
        <section key={g.key} className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-bold text-ink-2">{g.label}</h2>
          <div className="space-y-2">
            {g.items.map(e => {
              const d = parseDate(e.date)
              const isToday = e.date === t
              const w = weather && e.status !== 'canceled' ? wbgtFor(weather, e.date, e.start, e.minutes, e.indoor) : null
              const lv = w ? wbgtLevel(w.max) : null
              const mineMissing = !isAdmin && !isCoach && myPlayers.some(p => !e.att[p.id])
              const c = attCounts(e, players)
              return (
                <button key={e.id} onClick={() => nav(`/event/${e.id}`)} className={cx('flex w-full animate-up items-center gap-3 rounded-xl2 bg-white p-3 text-left shadow-card active:scale-[.99]', isToday && 'ring-2 ring-brand')}>
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
