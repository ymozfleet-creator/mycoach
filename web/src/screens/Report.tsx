import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { useApp } from '../lib/store'
import { Button, Card, PageHeader, Section, Segmented } from '../components/ui'
import { DOW, downloadCSV, iso, monthOf, parseDate, today, yen } from '../lib/util'

export default function Report() {
  const { club, events, players, fees, incidents, month } = useApp()
  const prev = monthOf(new Date(today().getFullYear(), today().getMonth() - 1, 1))
  const [m, setM] = useState(prev)
  const t = iso(today())
  const ss = useMemo(() => events.filter(e => e.status !== 'canceled' && e.date.startsWith(m) && e.date < t).sort((a, b) => a.date.localeCompare(b.date)), [events, m, t])
  if (!club) return null
  const count = (e: typeof ss[number]) => Object.values(e.att).filter(a => a === 'yes').length
  const part = ss.reduce((s, e) => s + count(e), 0)
  const hours = ss.reduce((s, e) => s + e.minutes, 0) / 60
  const coaches = [...new Set(ss.map(e => e.coachName).filter(Boolean))]
  const inc = incidents.filter(i => i.date.startsWith(m))
  const f = m === month ? fees : []
  const csv = () => downloadCSV(`実績報告_${club.name}_${m}.csv`, [['日付', '曜日', '開始', '活動時間(分)', '場所', '指導者', '参加人数', '登録会員数'], ...ss.map(e => [e.date, DOW[parseDate(e.date).getDay()], e.start, e.minutes, e.venue, e.coachName || '', count(e), players.length])])
  const rows: [string, string][] = [
    ['団体名', club.name],
    ['種目・地域', `${club.sport}／${club.areaLabel}`],
    ['活動回数', `${ss.length}回`],
    ['活動時間の合計', `${hours.toFixed(1)}時間`],
    ['登録会員数', `${players.length}人`],
    ['延べ参加人数', `${part}人（1回平均 ${ss.length ? (part / ss.length).toFixed(1) : 0}人）`],
    ['指導者', coaches.join('、') || '—'],
    ['会費の減免', `${players.filter(p => p.discount > 0).length}世帯`],
    ...(f.length ? [['会費の回収', `${yen(f.filter(x => x.status === 'paid').reduce((s, x) => s + x.amount, 0))}／${yen(f.reduce((s, x) => s + x.amount, 0))}`] as [string, string]] : []),
    ['安全記録', `事故 ${inc.filter(i => i.type === '事故').length}件・ヒヤリハット ${inc.filter(i => i.type === 'ヒヤリハット').length}件`],
  ]
  return (
    <>
      <PageHeader title="実績報告" back sub="自治体・補助金の報告用に自動で集計します" />
      <div className="no-print"><Segmented value={m} onChange={setM} options={[{ value: prev, label: `${+prev.slice(5)}月` }, { value: month, label: `${+month.slice(5)}月（途中）` }]} /></div>
      <Card className="mt-3">
        <h2 className="text-[16px] font-black">地域クラブ活動 実績報告（{m.slice(0, 4)}年{+m.slice(5)}月）</h2>
        <dl className="mt-3 divide-y divide-line text-[14px]">
          {rows.map(([k, v]) => <div key={k} className="flex gap-3 py-2"><dt className="w-28 shrink-0 text-ink-2">{k}</dt><dd className="flex-1 font-bold">{v}</dd></div>)}
        </dl>
      </Card>
      <Section title="活動の内訳">
        <Card className="divide-y divide-line !py-1 text-[14px]">
          {ss.length ? ss.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2.5">
              <span><b>{+e.date.slice(5, 7)}/{+e.date.slice(8)}（{DOW[parseDate(e.date).getDay()]}）</b> {e.start}〜 {e.minutes}分</span>
              <span className="text-ink-2">{count(e)}人</span>
            </div>
          )) : <p className="py-3 text-ink-2">この月の活動記録はありません。</p>}
        </Card>
      </Section>
      <div className="no-print mt-4 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={csv}><Download size={16} />CSVで保存</Button>
        <Button variant="ghost" onClick={() => print()}><Printer size={16} />印刷・PDF</Button>
      </div>
    </>
  )
}
