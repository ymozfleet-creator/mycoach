import { useMemo } from 'react'
import { CheckCheck } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Sheet, stagger } from './ui'
import { AttButtons } from './parts'
import { dateLabel, iso, today } from '../lib/util'

/** 保護者向け：出欠が未回答の予定を、まとめて回答するシート */
export function useUnanswered() {
  const { events, myPlayers } = useApp()
  const t = iso(today())
  return useMemo(() => events
    .filter(e => e.date >= t && e.status !== 'canceled' && myPlayers.some(p => !e.att[p.id]))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [events, myPlayers, t])
}

export function BulkAttendance({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { be, club, events, myPlayers, toast } = useApp()
  const list = useUnanswered()
  // シートを開いている間は、回答済みになった予定も残して表示する（回答した直後に消えないように）
  const shown = useMemo(() => {
    const t = iso(today())
    const ids = new Set(list.map(e => e.id))
    return events.filter(e => ids.has(e.id) || (e.date >= t && e.status !== 'canceled')).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 8)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!club) return null
  const allYes = async () => {
    for (const e of list) for (const p of myPlayers) if (!e.att[p.id]) await be.setAttendance(club.id, e.id, p.id, 'yes')
    toast('未回答の予定をすべて「参加」にしました')
  }
  return (
    <Sheet open={open} onClose={onClose} title="出欠をまとめて回答" footer={<div className="space-y-2">
      {list.length > 0 && <Button block variant="soft" onClick={allYes}><CheckCheck size={18} />未回答をすべて「参加」にする</Button>}
      <Button block size="lg" onClick={onClose}>{list.length ? `あとで回答する（残り${list.length}件）` : '完了'}</Button>
    </div>}>
      <div className="space-y-3">
        {shown.map((e0, i) => {
          const e = events.find(x => x.id === e0.id) || e0
          return (
            <div key={e.id} style={stagger(i)} className="animate-up rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-baseline gap-2"><b className="text-[14px] text-brand">{dateLabel(e.date)}</b><span className="truncate text-[13px] font-bold">{e.start}〜 {e.title}</span></div>
              <div className="space-y-2">
                {myPlayers.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] text-ink-2">{p.name}</span>
                    <AttButtons compact value={e.att[p.id]} onChange={a => be.setAttendance(club.id, e.id, p.id, a)} />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
