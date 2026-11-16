import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HeartPulse, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { Avatar, Badge, Button, Card, PageHeader, Section, Sheet, Segmented } from '../components/ui'
import { ConditionSheet } from '../components/sheets'
import { dateLabel, loadStatus } from '../lib/util'

export default function PlayerDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { be, club, players, conditions, events, isAdmin, isCoach, isSchool, toast } = useApp()
  const schoolView = isSchool && !isAdmin && !isCoach
  const p = players.find(x => x.id === id)
  const [rec, setRec] = useState(false)
  const [del, setDel] = useState(false)
  if (!p || !club) return <><PageHeader title="会員" back /><Card>見つかりません。</Card></>
  const s = loadStatus(conditions, p.id)
  const max = Math.max(...s.weeks, 1)
  const recent = conditions.filter(c => c.playerId === p.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  const advice = s.tone === 'danger' ? '直近1週間の練習量が、過去4週の平均より大きく増えています（目安は0.8〜1.3倍）。強度を下げる日や休養日を入れることを検討してください。' : s.tone === 'warn' ? '練習量がやや増えています。疲れや痛みがないか声をかけましょう。' : s.tone === 'none' ? '直近1週間の記録がありません。練習後に記録すると、けがの予防に役立ちます。' : '練習量は安定しています。'
  return (
    <>
      <PageHeader title={p.name} back sub={p.grade} />
      <Card className="flex items-center gap-4">
        <Avatar name={p.name} size={56} />
        <div className="flex-1">
          {!schoolView && <Badge tone={s.tone === 'none' ? 'none' : s.tone}>{s.label}</Badge>}
          {!schoolView && <div className="mt-1 text-[13px] text-ink-2">{s.reason}</div>}
          {schoolView && <div className="text-[13px] text-ink-2">{p.grade}</div>}
        </div>
      </Card>
      {schoolView ? (
        <Section title="参加の記録（直近の活動）">
          <Card className="divide-y divide-line !py-1">
            {events.filter(e => e.status !== 'canceled' && e.date < new Date().toISOString().slice(0, 10)).slice(-10).reverse().map(e => (
              <div key={e.id} className="flex items-center justify-between py-2.5 text-[14px]"><span className="font-bold">{dateLabel(e.date)}</span><Badge tone={e.att[p.id] === 'yes' ? 'ok' : e.att[p.id] === 'no' ? 'none' : 'warn'}>{e.att[p.id] === 'yes' ? '参加' : e.att[p.id] === 'no' ? '欠席' : '未回答'}</Badge></div>
            ))}
          </Card>
          <p className="mt-2 px-1 text-[11px] text-ink-3">体調・練習量の記録は、指導者と保護者のみが閲覧できます。</p>
        </Section>
      ) : <>
      <Section title="練習量の推移（週ごと）">
        <Card>
          <div className="flex h-36 items-end gap-3">
            {s.weeks.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="text-[11px] text-ink-2">{v ? v.toLocaleString() : ''}</div>
                <div className={`w-full origin-bottom animate-[up_.5s_both] rounded-t-xl ${i === 3 ? (s.tone === 'danger' ? 'bg-red-400' : s.tone === 'warn' ? 'bg-amber-400' : 'bg-brand') : 'bg-brand-100'}`} style={{ height: `${(v / max) * 100}%`, minHeight: 4 }} />
                <div className="text-[11px] font-bold text-ink-2">{i === 3 ? '今週' : `${3 - i}週前`}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-2xl bg-canvas p-3 text-[13px] leading-relaxed">{advice}</p>
          <p className="mt-2 text-[11px] text-ink-3">練習量＝きつさ（1〜10）×練習時間（分）。けが予防の目安として、スポーツ現場で広く使われている考え方です。医学的な診断ではありません。</p>
        </Card>
      </Section>
      <Section title="最近の記録" action={<button onClick={() => setRec(true)} className="flex items-center gap-1 text-[13px] font-bold text-brand"><HeartPulse size={15} />記録する</button>}>
        <Card className="divide-y divide-line !py-1">
          {recent.length ? recent.map(c => (
            <div key={c.id} className="flex items-center justify-between py-2.5 text-[14px]">
              <span className="font-bold">{dateLabel(c.date)}</span>
              <span className="text-ink-2">きつさ {c.rpe}・{c.minutes}分・睡眠 {c.sleep}h</span>
            </div>
          )) : <p className="py-3 text-[14px] text-ink-2">記録はまだありません。</p>}
        </Card>
      </Section>
      </>}
      {isAdmin && (
        <Section title="会費">
          <Card>
            <Segmented value={String(p.discount)} onChange={v => { be.savePlayer(club.id, { ...p, discount: Number(v) }); toast('会費の設定を変更しました') }} options={[{ value: '0', label: '通常' }, { value: '50', label: '半額' }, { value: '100', label: '免除' }]} />
            <p className="mt-2 text-[12px] text-ink-3">経済的な事情などによる減免です。本人や他の保護者には表示されません。来月の請求から反映されます。</p>
          </Card>
          <Button block variant="danger" className="mt-4" onClick={() => setDel(true)}><Trash2 size={16} />この会員を削除</Button>
        </Section>
      )}
      <ConditionSheet open={rec} onClose={() => setRec(false)} players={[p]} defaultPlayer={p.id} />
      <Sheet open={del} onClose={() => setDel(false)} title="会員を削除しますか？" footer={<Button block size="lg" variant="danger" onClick={async () => { await be.removePlayer(club.id, p.id); toast('削除しました'); nav('/players') }}>削除する</Button>}>
        <p className="text-[14px] leading-relaxed">{p.name}さんを会員一覧から削除します。過去の出欠・記録は残ります。元に戻すことはできません。</p>
      </Sheet>
    </>
  )
}
