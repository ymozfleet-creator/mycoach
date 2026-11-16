import { Clock, MapPin, Thermometer, UserRound } from 'lucide-react'
import { useApp } from '../lib/store'
import { useEffect, useState } from 'react'
import type { Att, AttNote, ClubEvent, Player } from '../lib/types'
import { dateLabel, endTime, wbgtFor, wbgtLevel } from '../lib/util'
import { Badge, cx, Skeleton } from './ui'

export function useEventWbgt(e: ClubEvent) {
  const { weather, weatherError } = useApp()
  if (weatherError) return { state: 'error' as const }
  if (!weather) return { state: 'loading' as const }
  const r = wbgtFor(weather, e.date, e.start, e.minutes, e.indoor)
  if (!r) return { state: 'out' as const }
  return { state: 'ok' as const, ...r, level: wbgtLevel(r.max) }
}

export function WbgtBadge({ e }: { e: ClubEvent }) {
  const w = useEventWbgt(e)
  if (w.state === 'loading') return <Skeleton className="h-6 w-24" />
  if (w.state !== 'ok') return null
  return (
    <Badge tone={w.level.tone}>
      <Thermometer size={13} />暑さ指数 {w.max.toFixed(1)}・{w.level.label}
    </Badge>
  )
}

export function EventMeta({ e }: { e: ClubEvent }) {
  return (
    <div className="mt-2 space-y-1 text-[13px] text-ink-2">
      <div className="flex items-center gap-1.5"><Clock size={14} />{e.start}〜{endTime(e.start, e.minutes)}</div>
      <div className="flex items-center gap-1.5"><MapPin size={14} />{e.venue}{e.indoor ? '（屋内）' : '（屋外）'}</div>
      {e.coachName && <div className="flex items-center gap-1.5"><UserRound size={14} />指導：{e.coachName}</div>}
    </div>
  )
}

export function AttButtons({ value, onChange, compact }: { value?: Att; onChange: (a: Att) => void; compact?: boolean }) {
  const opts: { v: Att; label: string; on: string }[] = [
    { v: 'yes', label: '参加', on: 'bg-emerald-500 text-white border-emerald-500' },
    { v: 'maybe', label: '未定', on: 'bg-amber-400 text-white border-amber-400' },
    { v: 'no', label: '欠席', on: 'bg-slate-500 text-white border-slate-500' },
  ]
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button key={o.v + (value === o.v ? '-on' : '')} onClick={ev => { ev.stopPropagation(); if (navigator.vibrate) navigator.vibrate(8); onChange(o.v) }}
          aria-pressed={value === o.v}
          className={cx('rounded-xl border font-bold transition-colors duration-200 active:scale-95', compact ? 'h-8 px-3 text-[12px]' : 'h-10 flex-1 text-[14px]', value === o.v ? cx(o.on, 'animate-pop shadow-sm') : 'border-line bg-white text-ink-2')}>
          {value === o.v ? '✓ ' : ''}{o.label}
        </button>
      ))}
    </div>
  )
}

export function attCounts(e: ClubEvent, players: Player[]) {
  const v = players.map(p => e.att[p.id])
  return { yes: v.filter(x => x === 'yes').length, no: v.filter(x => x === 'no').length, maybe: v.filter(x => x === 'maybe').length, none: v.filter(x => !x).length, total: players.length }
}

export function EventCard({ e, onClick, children }: { e: ClubEvent; onClick?: () => void; children?: React.ReactNode }) {
  const canceled = e.status === 'canceled'
  return (
    <div onClick={onClick} className={cx('animate-up rounded-xl2 bg-white p-4 shadow-card', onClick && 'cursor-pointer transition active:scale-[.99]')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-brand">{dateLabel(e.date)}</div>
          <div className={cx('mt-0.5 text-[17px] font-black', canceled && 'text-ink-3 line-through')}>{e.title}</div>
        </div>
        {canceled ? <Badge tone="danger">中止</Badge> : <WbgtBadge e={e} />}
      </div>
      <EventMeta e={e} />
      {children}
    </div>
  )
}

const REASONS = ['体調不良', 'ケガ', '学校の行事', '家庭の用事', 'その他']
/** 欠席を選んだときの理由（任意）。運営・指導者だけが見られる */
export function AbsenceReason({ eventId, playerId, notes }: { eventId: string; playerId: string; notes: AttNote[] }) {
  const { be, club, toast } = useApp()
  const cur = notes.find(n => n.playerId === playerId)?.note
  if (!club) return null
  return (
    <div className="mt-2 rounded-xl bg-canvas p-2.5">
      <div className="mb-1.5 text-[12px] font-bold text-ink-2">欠席の理由（任意・運営と指導者だけに伝わります）</div>
      <div className="flex flex-wrap gap-1.5">{REASONS.map(r => (
        <button key={r} onClick={() => be.setAttNote(club.id, eventId, playerId, r).then(() => toast('理由を伝えました')).catch(() => toast('送れませんでした'))}
          className={cx('rounded-full border px-3 py-1 text-[12px] font-bold', cur === r ? 'border-slate-500 bg-slate-500 text-white' : 'border-line bg-white text-ink-2')}>{r}</button>
      ))}</div>
    </div>
  )
}

export function useAttNotes(eventId: string | undefined, onlyMine: boolean) {
  const { be, club, authUser } = useApp()
  const [n, setN] = useState<AttNote[]>([])
  useEffect(() => (club && eventId && authUser ? be.watchAttNotes(club.id, eventId, setN, onlyMine ? authUser.uid : undefined) : undefined), [be, club?.id, eventId, onlyMine, authUser?.uid])
  return n
}
