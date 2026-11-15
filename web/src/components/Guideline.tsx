import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, Info, TriangleAlert } from 'lucide-react'
import { useApp } from '../lib/store'
import { Card, Section, cx } from './ui'
import { DOW, guidelineWeeks, parseDate } from '../lib/util'

/** 部活動ガイドライン（休養日・活動時間）の遵守状況。直近4週を週ごとに表示 */
export function GuidelineCard() {
  const { events } = useApp()
  const weeks = useMemo(() => guidelineWeeks(events, 4), [events])
  const [open, setOpen] = useState(false)
  const done = weeks.slice(0, 3)
  const okCount = done.filter(w => w.ok).length
  const now = weeks[3]
  return (
    <Section title="活動時間と休養日（ガイドライン）">
      <Card>
        <div className="flex items-center gap-3">
          <div className={cx('grid h-12 w-12 place-items-center rounded-2xl', okCount === 3 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
            {okCount === 3 ? <CheckCircle2 size={26} /> : <TriangleAlert size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-black">{okCount === 3 ? '直近3週はすべて目安内です' : `直近3週のうち ${3 - okCount}週が目安を超えています`}</div>
            <div className="text-[12px] text-ink-2">休養日 週2日以上（平日・土日に各1日以上）、活動は平日2時間・休日3時間程度</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {weeks.map((w, i) => (
            <div key={w.from} style={{ animationDelay: `${i * 70}ms` }} className={cx('animate-up rounded-2xl p-2 text-center', i === 3 ? 'bg-slate-50 ring-1 ring-line' : w.ok ? 'bg-emerald-50' : 'bg-amber-50')}>
              <div className="text-[11px] font-bold text-ink-2">{w.label}</div>
              <div className="mt-1 flex justify-center gap-0.5">
                {Array.from({ length: 7 }, (_, d) => {
                  const date = new Date(parseDate(w.from)); date.setDate(date.getDate() + d)
                  const active = events.some(e => e.status !== 'canceled' && e.date === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
                  return <span key={d} title={DOW[date.getDay()]} className={cx('h-3.5 w-1.5 rounded-full', active ? (i === 3 ? 'bg-brand' : w.ok ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200')} />
                })}
              </div>
              <div className="mt-1 text-[11px]">休養 <b>{w.restDays}</b>日</div>
            </div>
          ))}
        </div>
        <button onClick={() => setOpen(!open)} className="mt-3 flex w-full items-center justify-center gap-1 text-[13px] font-bold text-brand">詳しく見る<ChevronDown size={16} className={cx('transition-transform', open && 'rotate-180')} /></button>
        <div className={cx('grid transition-all duration-300', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
          <div className="overflow-hidden">
            <ul className="mt-2 space-y-2 text-[13px]">
              {weeks.map(w => (
                <li key={w.from} className="rounded-xl bg-canvas p-3">
                  <div className="font-bold">{w.label}（{+w.from.slice(5, 7)}/{+w.from.slice(8)}〜）活動 {w.days}日・計 {w.hours.toFixed(1)}時間{w.label === '今週' ? '（予定を含む）' : ''}</div>
                  <div className="mt-1 text-ink-2">
                    {w.restDays < 2 && <div>・休養日が{w.restDays}日です（目安は2日以上）</div>}
                    {!w.weekdayRest && <div>・平日の休養日がありません</div>}
                    {!w.weekendRest && <div>・土日の休養日がありません</div>}
                    {w.overDays.map(o => <div key={o.date}>・{+o.date.slice(5, 7)}/{+o.date.slice(8)}は{o.minutes}分（目安{o.limit}分）</div>)}
                    {w.ok && <div>・目安内です</div>}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 flex gap-1 text-[11px] text-ink-3"><Info size={13} className="shrink-0" />スポーツ庁の部活動ガイドラインの目安をもとに、このクラブの予定から自動で確認しています。</p>
          </div>
        </div>
      </Card>
      {now && null}
    </Section>
  )
}
