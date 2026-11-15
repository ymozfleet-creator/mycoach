import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, Megaphone, Sparkles } from 'lucide-react'
import { useApp } from '../lib/store'
import { useEventWbgt } from '../components/parts'
import { Badge, Button, Card, Field, inputCls, PageHeader, Section, cx } from '../components/ui'
import { makeMenu, type MenuResult } from '../lib/ai'
import { dateLabel, wbgtLevel } from '../lib/util'
import type { ClubEvent } from '../lib/types'

const GOALS = ['基礎技術', 'シュート', '守備', '試合形式', '体力づくり']

export default function Menu() {
  const { be, club, events, players, profile, toast } = useApp()
  const [sp] = useSearchParams()
  const ev = events.find(e => e.id === sp.get('event'))
  const w = useEventWbgt(ev || ({ date: '', start: '0', minutes: 0, indoor: true } as ClubEvent))
  const attending = ev ? players.filter(p => ev.att[p.id] === 'yes').length : players.length
  const [goal, setGoal] = useState('基礎技術')
  const [minutes, setMinutes] = useState(ev?.minutes || 120)
  const [level, setLevel] = useState('中級')
  const [note, setNote] = useState('')
  const [res, setRes] = useState<MenuResult | null>(null)
  const [busy, setBusy] = useState(false)
  const wb = w.state === 'ok' ? w.max : null
  const text = useMemo(() => res ? `【練習メニュー】${ev ? dateLabel(ev.date) + ' ' : ''}${goal}／${minutes}分\n` + res.blocks.map(b => `${b.from}〜${b.to}分　${b.title}：${b.detail}${b.caution ? `（${b.caution}）` : ''}`).join('\n') + (res.points.length ? '\n\n' + res.points.map(p => '・' + p).join('\n') : '') : '', [res])
  if (!club) return null
  const run = async () => {
    setBusy(true); setRes(null)
    const r = await makeMenu({ sport: club.sport, goal, minutes, players: attending || players.length, wbgt: wb, level, note }, be.mode)
    setRes(r); setBusy(false)
  }
  return (
    <>
      <PageHeader title="練習メニューを作る" back sub={ev ? `${dateLabel(ev.date)} ${ev.title}` : club.sport} />
      <Card>
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Badge tone="none">参加予定 {attending}人</Badge>
          {wb != null && <Badge tone={wbgtLevel(wb).tone}>暑さ指数 {wb}・{wbgtLevel(wb).label}</Badge>}
        </div>
        <Field label="ねらい"><div className="mt-2 flex flex-wrap gap-2">{GOALS.map(g => <button key={g} onClick={() => setGoal(g)} className={cx('rounded-full border px-3.5 py-2 text-[13px] font-bold', goal === g ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2')}>{g}</button>)}</div></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="時間"><select className={inputCls} value={minutes} onChange={e => setMinutes(+e.target.value)}>{[60, 90, 120, 150, 180].map(m => <option key={m} value={m}>{m}分</option>)}</select></Field>
          <Field label="レベル"><select className={inputCls} value={level} onChange={e => setLevel(e.target.value)}>{['初心者', '中級', '上級'].map(m => <option key={m}>{m}</option>)}</select></Field>
        </div>
        <Field label="気になっていること（任意）"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="例：パスミスが多い、1年生が多い" /></Field>
        <Button block size="lg" variant="lime" loading={busy} onClick={run}><Sparkles size={18} />メニューを作る</Button>
      </Card>
      {res && (
        <Section title="練習メニュー" action={<Badge tone={res.source === 'ai' ? 'lime' : 'none'}>{res.source === 'ai' ? 'AIが作成' : '標準テンプレート'}</Badge>}>
          <Card className="!p-0">
            <ol className="relative">
              {res.blocks.map((b, i) => (
                <li key={i} className={cx('flex gap-3 px-4 py-3', i > 0 && 'border-t border-line', b.title === '休憩' && 'bg-sky-50/60')}>
                  <div className="w-16 shrink-0 text-[12px] font-bold text-brand">{b.from}〜{b.to}分</div>
                  <div className="min-w-0 flex-1"><div className="font-bold">{b.title}</div><div className="text-[13px] text-ink-2">{b.detail}</div>{b.caution && <div className="mt-1 text-[12px] font-bold text-red-600">⚠ {b.caution}</div>}</div>
                </li>
              ))}
            </ol>
          </Card>
          {res.points.length > 0 && <Card className="mt-2 space-y-1 text-[13px]">{res.points.map((p, i) => <p key={i}>・{p}</p>)}</Card>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={async () => { await navigator.clipboard.writeText(text); toast('コピーしました') }}><Copy size={16} />コピー</Button>
            <Button variant="soft" onClick={async () => { await be.postAnnouncement(club.id, { text, kind: 'info', byName: profile?.name || '', at: Date.now() }); toast('クラブのお知らせに共有しました') }}><Megaphone size={16} />みんなに共有</Button>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">自動で作成した案です。選手の様子を見て、指導者が調整してください。</p>
        </Section>
      )}
    </>
  )
}
